package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"time"
)

const maxFetchedDrop = 500

type MonthFile struct {
	GeneratedAt        string            `json:"generated_at"`
	RatingsUpdate      string            `json:"ratings_update"`
	ActiveWindowMonths int               `json:"active_window_months"`
	TotalPlayers       int               `json:"total_players"`
	PlayersFetched     int               `json:"players_fetched,omitempty"`
	Ratings            map[int]int       `json:"ratings"`
	Divisions          map[string]Counts `json:"divisions,omitempty"`
	Locations          []string          `json:"locations,omitempty"`
}

type LocationFile struct {
	Location     string            `json:"location"`
	TotalPlayers int               `json:"total_players"`
	Ratings      map[int]int       `json:"ratings"`
	Divisions    map[string]Counts `json:"divisions,omitempty"`
}

const currentName = "current"

func currentPath(dir string) string {
	return filepath.Join(dir, currentName+".json")
}

// readCurrent returns a zero MonthFile when no snapshot has been written yet.
func readCurrent(dir string) (MonthFile, error) {
	var m MonthFile
	err := readJSON(currentPath(dir), &m)
	if errors.Is(err, fs.ErrNotExist) {
		return MonthFile{}, nil
	}
	return m, err
}

func checkFetched(prev, cur int) error {
	if prev == 0 || prev-cur <= maxFetchedDrop {
		return nil
	}
	return fmt.Errorf("fetched %d player records, %d fewer than previous %d; paging may have stopped early",
		cur, prev-cur, prev)
}

// writeCurrent replaces the snapshot. Older months live on in git history and
// in the yearly files, so they aren't kept on disk.
func writeCurrent(dir string, update, now time.Time, s Summary) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	month := MonthFile{
		GeneratedAt:        now.UTC().Format(time.DateOnly),
		RatingsUpdate:      update.Format(time.DateOnly),
		ActiveWindowMonths: activeWindowMonths,
		TotalPlayers:       s.Total,
		PlayersFetched:     s.Fetched,
		Ratings:            s.Ratings,
		Divisions:          s.Divisions,
		Locations:          slices.Sorted(maps.Keys(s.Locations)),
	}
	if err := writeLocations(filepath.Join(dir, currentName), s.Locations); err != nil {
		return err
	}
	// Written last: a current.json with this ratings_update marks the month done.
	return writeJSONAtomic(currentPath(dir), month)
}

func writeLocations(dir string, locations map[string]LocationCounts) error {
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	if len(locations) == 0 {
		return nil
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	for key, loc := range locations {
		file := LocationFile{
			Location:     key,
			TotalPlayers: loc.Total,
			Ratings:      loc.Ratings,
			Divisions:    loc.Divisions,
		}
		if err := writeJSONAtomic(filepath.Join(dir, key+".json"), file); err != nil {
			return err
		}
	}
	return nil
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
	b, err := json.Marshal(v)
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
