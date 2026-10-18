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
	flag.Parse()
	cfg.baseURL = defaultBaseURL
	if cfg.maxPages > 0 {
		cfg.dryRun = true
	}

	log.SetFlags(0)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	err := run(ctx, cfg, time.Now())
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
	key := monthKey(update)
	if !happened {
		return fmt.Errorf("%w: next ratings update is %s", errSkipped, update.Format(time.DateOnly))
	}
	exists, err := monthExists(cfg.dataDir, key)
	if err != nil {
		return err
	}
	if exists && !cfg.dryRun {
		return fmt.Errorf("%w: %s already written", errSkipped, key)
	}

	if err := loadDotEnv(cfg.envFile); err != nil {
		return fmt.Errorf("loading %s: %w", cfg.envFile, err)
	}
	username, password := os.Getenv("PDGA_USERNAME"), os.Getenv("PDGA_PASSWORD")
	if username == "" || password == "" {
		return errors.New("PDGA_USERNAME and PDGA_PASSWORD must be set")
	}

	c := NewClient()
	c.Delay = cfg.delay
	c.BaseURL = cfg.baseURL
	if err := c.Login(ctx, username, password); err != nil {
		return err
	}
	defer func() {
		// Use a fresh context so logout still runs after cancellation.
		logoutCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := c.Logout(logoutCtx); err != nil {
			log.Printf("warning: %v", err)
		}
	}()

	c.Progress = progressLogger(cfg, "pass 1 of 2: players")
	players, err := c.FetchPlayers(ctx, cfg.maxPages)
	if err != nil {
		return err
	}
	s := summarize(players, update)
	log.Printf("fetched %d players: %d active, %d zero, %d malformed, published=%v",
		len(players), s.Total, s.Zero, s.Malformed, s.Published)
	// Free the full player list; only active numbers are needed from here on.
	players = nil

	// Checked before the second pass so retry days don't double the API load.
	if !cfg.dryRun && !s.Published {
		return fmt.Errorf("%w: ratings for %s not published yet", errSkipped, update.Format(time.DateOnly))
	}

	tracker := newDivisionTracker(s.Active)
	for _, year := range divisionYears(update) {
		c.Progress = progressLogger(cfg, fmt.Sprintf("pass 2 of 2: %d divisions", year))
		rows, err := c.FetchPlayerStatistics(ctx, year, cfg.maxPages, tracker.add)
		if err != nil {
			return err
		}
		log.Printf("fetched %d player statistics rows for %d", rows, year)
	}
	s.Divisions = tracker.counts()
	s.Active = nil
	log.Printf("%d divisions with active players", len(s.Divisions))

	if cfg.dryRun {
		return fmt.Errorf("%w: dry run, nothing written", errSkipped)
	}
	prev, err := previousTotal(cfg.dataDir)
	if err != nil {
		return err
	}
	if err := checkTotal(prev, s.Total); err != nil {
		return err
	}
	if err := writeMonth(cfg.dataDir, update, now, s); err != nil {
		return err
	}
	log.Printf("wrote %s", monthPath(cfg.dataDir, key))
	return nil
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
