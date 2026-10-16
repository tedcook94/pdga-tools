package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"time"
)

const maxTotalChange = 0.10

type MonthFile struct {
	GeneratedAt        string      `json:"generated_at"`
	RatingsUpdate      string      `json:"ratings_update"`
	ActiveWindowMonths int         `json:"active_window_months"`
	TotalPlayers       int         `json:"total_players"`
	Ratings            map[int]int `json:"ratings"`
}

type Index struct {
	Months []string `json:"months"`
	Latest string   `json:"latest"`
}

func monthPath(dir, key string) string {
	return filepath.Join(dir, key+".json")
}

func monthExists(dir, key string) (bool, error) {
	_, err := os.Stat(monthPath(dir, key))
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	return err == nil, err
}

func readIndex(dir string) (Index, error) {
	var idx Index
	err := readJSON(filepath.Join(dir, "index.json"), &idx)
	if errors.Is(err, fs.ErrNotExist) {
		return Index{}, nil
	}
	return idx, err
}

// previousTotal returns 0 when there is no earlier month to compare against.
func previousTotal(dir string) (int, error) {
	idx, err := readIndex(dir)
	if err != nil || idx.Latest == "" {
		return 0, err
	}
	var prev MonthFile
	if err := readJSON(monthPath(dir, idx.Latest), &prev); err != nil {
		return 0, err
	}
	return prev.TotalPlayers, nil
}

func checkTotal(prev, cur int) error {
	if prev == 0 {
		return nil
	}
	change := float64(cur-prev) / float64(prev)
	if change > maxTotalChange || change < -maxTotalChange {
		return fmt.Errorf("active total %d differs from previous %d by %.1f%%", cur, prev, change*100)
	}
	return nil
}

func writeMonth(dir string, update, now time.Time, s Summary) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	key := monthKey(update)
	month := MonthFile{
		GeneratedAt:        now.UTC().Format(time.DateOnly),
		RatingsUpdate:      update.Format(time.DateOnly),
		ActiveWindowMonths: activeWindowMonths,
		TotalPlayers:       s.Total,
		Ratings:            s.Ratings,
	}
	if err := writeJSONAtomic(monthPath(dir, key), month); err != nil {
		return err
	}

	idx, err := readIndex(dir)
	if err != nil {
		return err
	}
	if !slices.Contains(idx.Months, key) {
		idx.Months = append(idx.Months, key)
	}
	slices.Sort(idx.Months)
	idx.Latest = idx.Months[len(idx.Months)-1]
	return writeJSONAtomic(filepath.Join(dir, "index.json"), idx)
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("%s: %w", path, err)
	}
	return nil
}

func writeJSONAtomic(path string, v any) error {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".tmp-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if _, err := tmp.Write(append(b, '\n')); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}
