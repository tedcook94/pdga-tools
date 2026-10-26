package main

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type HistoryFile struct {
	Year         int         `json:"year"`
	GeneratedAt  string      `json:"generated_at"`
	TotalPlayers int         `json:"total_players"`
	Ratings      map[int]int `json:"ratings"`
}

type yearTracker struct {
	ratings map[string]int
}

func newYearTracker() *yearTracker {
	return &yearTracker{ratings: map[string]int{}}
}

func (y *yearTracker) add(row PlayerStat) {
	if row.Rating == nil {
		return
	}
	rating, err := strconv.Atoi(*row.Rating)
	// Zero is a placeholder in /players too; it isn't a real rating.
	if err != nil || rating <= 0 {
		return
	}
	y.ratings[row.PDGANumber] = rating
}

func (y *yearTracker) counts() Counts {
	c := Counts{Ratings: map[int]int{}}
	for _, rating := range y.ratings {
		c.Ratings[rating]++
		c.Total++
	}
	return c
}

func historyPath(dir string, year int) string {
	return filepath.Join(dir, "history", strconv.Itoa(year)+".json")
}

func historyExists(dir string, year int) (bool, error) {
	_, err := os.Stat(historyPath(dir, year))
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return err == nil, err
}

func writeHistory(dir string, year int, now time.Time, c Counts) (bool, error) {
	if c.Total == 0 {
		return false, nil
	}
	if err := os.MkdirAll(filepath.Join(dir, "history"), 0o755); err != nil {
		return false, err
	}
	file := HistoryFile{
		Year:         year,
		GeneratedAt:  now.UTC().Format(time.DateOnly),
		TotalPlayers: c.Total,
		Ratings:      c.Ratings,
	}
	return true, writeJSONAtomic(historyPath(dir, year), file)
}

func parseYears(s string) (from, to int, err error) {
	first, last, isRange := strings.Cut(s, "-")
	if from, err = strconv.Atoi(first); err != nil {
		return 0, 0, fmt.Errorf("invalid year range %q", s)
	}
	to = from
	if isRange {
		if to, err = strconv.Atoi(last); err != nil {
			return 0, 0, fmt.Errorf("invalid year range %q", s)
		}
	}
	if from < 1980 || to < from || to > 2100 {
		return 0, 0, fmt.Errorf("invalid year range %q", s)
	}
	return from, to, nil
}
