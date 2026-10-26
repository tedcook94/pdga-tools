package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	exitWritten = 0
	exitFailed  = 1
	exitSkipped = 3
)

type config struct {
	dataDir  string
	envFile  string
	maxPages int
	delay    time.Duration
	dryRun   bool
	baseURL  string
	progress int
	backfill string
}

var errSkipped = errors.New("skipped")

func main() {
	var cfg config
	flag.StringVar(&cfg.dataDir, "data", "data", "directory for monthly output files")
	flag.StringVar(&cfg.envFile, "env", ".env", "file to load credentials from")
	flag.IntVar(&cfg.maxPages, "max-pages", 0, "stop after this many pages (0 = all); implies -dry-run")
	flag.DurationVar(&cfg.delay, "delay", time.Second, "minimum time between API requests")
	flag.BoolVar(&cfg.dryRun, "dry-run", false, "fetch and summarize without writing files")
	flag.IntVar(&cfg.progress, "progress", 50, "log progress every N pages (0 = off)")
	flag.StringVar(&cfg.backfill, "backfill", "", "write yearly history for a range like 2000-2024, skipping years already written")
	flag.Parse()
	cfg.baseURL = defaultBaseURL
	if cfg.maxPages > 0 {
		cfg.dryRun = true
	}

	log.SetFlags(0)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	runner := run
	if cfg.backfill != "" {
		runner = backfill
	}
	err := runner(ctx, cfg, time.Now())
	switch {
	case err == nil:
		os.Exit(exitWritten)
	case errors.Is(err, errSkipped):
		log.Print(err)
		os.Exit(exitSkipped)
	default:
		log.Printf("error: %v", err)
		os.Exit(exitFailed)
	}
}

func run(ctx context.Context, cfg config, now time.Time) error {
	update, happened := currentUpdate(now)
	if !happened {
		return fmt.Errorf("%w: next ratings update is %s", errSkipped, update.Format(time.DateOnly))
	}
	current, err := readCurrent(cfg.dataDir)
	if err != nil {
		return err
	}
	if current.RatingsUpdate == update.Format(time.DateOnly) && !cfg.dryRun {
		return fmt.Errorf("%w: %s already written", errSkipped, monthKey(update))
	}

	c, logout, err := login(ctx, cfg)
	if err != nil {
		return err
	}
	defer logout()

	c.Progress = progressLogger(cfg, "pass 1 of 2: players")
	players, err := c.FetchPlayers(ctx, cfg.maxPages)
	if err != nil {
		return err
	}
	s := summarize(players, update)
	s.Fetched = len(players)
	log.Printf("fetched %d players: %d active, %d zero, %d malformed, published=%v",
		len(players), s.Total, s.Zero, s.Malformed, s.Published)
	// Free the full player list; only active numbers are needed from here on.
	players = nil

	// Checked before the second pass so retry days don't double the API load.
	if !cfg.dryRun && !s.Published {
		return fmt.Errorf("%w: ratings for %s not published yet", errSkipped, update.Format(time.DateOnly))
	}

	// The same rows give each year's history, so the current and previous
	// years stay up to date with no extra API calls.
	tracker := newDivisionTracker(s.Active)
	history := map[int]Counts{}
	for _, year := range divisionYears(update) {
		c.Progress = progressLogger(cfg, fmt.Sprintf("pass 2 of 2: %d divisions", year))
		yt := newYearTracker()
		rows, err := c.FetchPlayerStatistics(ctx, year, cfg.maxPages, func(row PlayerStat) {
			tracker.add(row)
			yt.add(row)
		})
		if err != nil {
			return err
		}
		history[year] = yt.counts()
		log.Printf("fetched %d player statistics rows for %d: %d rated players", rows, year, history[year].Total)
	}
	s.Divisions = tracker.counts()
	s.Locations = tracker.locationCounts(s.ActiveLocations)
	s.Active, s.ActiveLocations = nil, nil
	log.Printf("%d divisions and %d locations with active players", len(s.Divisions), len(s.Locations))

	if cfg.dryRun {
		return fmt.Errorf("%w: dry run, nothing written", errSkipped)
	}
	if err := checkFetched(current.PlayersFetched, s.Fetched); err != nil {
		return err
	}
	for year, counts := range history {
		if _, err := writeHistory(cfg.dataDir, year, now, counts); err != nil {
			return err
		}
	}
	// Written after history: current.json marks the month done, so a failed
	// history write gets retried the next day.
	if err := writeCurrent(cfg.dataDir, update, now, s); err != nil {
		return err
	}
	log.Printf("wrote %s for %s", currentPath(cfg.dataDir), monthKey(update))
	return nil
}

func backfill(ctx context.Context, cfg config, now time.Time) error {
	from, to, err := parseYears(cfg.backfill)
	if err != nil {
		return err
	}
	c, logout, err := login(ctx, cfg)
	if err != nil {
		return err
	}
	defer logout()

	written := 0
	for year := from; year <= to; year++ {
		if exists, err := historyExists(cfg.dataDir, year); err != nil {
			return err
		} else if exists && !cfg.dryRun {
			log.Printf("%d: already written, skipping", year)
			continue
		}
		c.Progress = progressLogger(cfg, fmt.Sprintf("backfill %d", year))
		yt := newYearTracker()
		rows, err := c.FetchPlayerStatistics(ctx, year, cfg.maxPages, yt.add)
		if err != nil {
			return err
		}
		counts := yt.counts()
		log.Printf("%d: %d rows, %d rated players", year, rows, counts.Total)
		if cfg.dryRun {
			continue
		}
		ok, err := writeHistory(cfg.dataDir, year, now, counts)
		if err != nil {
			return err
		}
		if ok {
			written++
		}
	}
	if cfg.dryRun {
		return fmt.Errorf("%w: dry run, nothing written", errSkipped)
	}
	if written == 0 {
		return fmt.Errorf("%w: no new years written", errSkipped)
	}
	log.Printf("wrote %d history files", written)
	return nil
}

func login(ctx context.Context, cfg config) (*Client, func(), error) {
	if err := loadDotEnv(cfg.envFile); err != nil {
		return nil, nil, fmt.Errorf("loading %s: %w", cfg.envFile, err)
	}
	username, password := os.Getenv("PDGA_USERNAME"), os.Getenv("PDGA_PASSWORD")
	if username == "" || password == "" {
		return nil, nil, errors.New("PDGA_USERNAME and PDGA_PASSWORD must be set")
	}

	c := NewClient()
	c.Delay = cfg.delay
	c.BaseURL = cfg.baseURL
	if err := c.Login(ctx, username, password); err != nil {
		return nil, nil, err
	}
	logout := func() {
		// Use a fresh context so logout still runs after cancellation.
		logoutCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := c.Logout(logoutCtx); err != nil {
			log.Printf("warning: %v", err)
		}
	}
	return c, logout, nil
}

func progressLogger(cfg config, label string) func(pages, rows int) {
	if cfg.progress <= 0 {
		return nil
	}
	start := time.Now()
	return func(pages, rows int) {
		if pages%cfg.progress == 0 {
			log.Printf("%s: page %d, %d rows, %s elapsed", label, pages, rows, time.Since(start).Round(time.Second))
		}
	}
}
