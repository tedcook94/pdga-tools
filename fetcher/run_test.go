package main

import (
	"context"
	"errors"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

func testConfig(t *testing.T, total int) config {
	t.Helper()
	srv := httptest.NewServer(&fakePDGA{total: total})
	t.Cleanup(srv.Close)
	t.Setenv("PDGA_USERNAME", "u")
	t.Setenv("PDGA_PASSWORD", "p")
	return config{
		dataDir: filepath.Join(t.TempDir(), "data"),
		envFile: filepath.Join(t.TempDir(), "missing.env"),
		baseURL: srv.URL,
	}
}

func TestRun(t *testing.T) {
	afterUpdate := time.Date(2026, 10, 13, 17, 0, 0, 0, time.UTC)
	ctx := context.Background()

	t.Run("before update skips without credentials", func(t *testing.T) {
		cfg := config{dataDir: t.TempDir()}
		err := run(ctx, cfg, time.Date(2026, 10, 12, 17, 0, 0, 0, time.UTC))
		if !errors.Is(err, errSkipped) {
			t.Fatalf("err = %v, want skipped", err)
		}
	})

	t.Run("writes then skips existing month", func(t *testing.T) {
		cfg := testConfig(t, 450)
		if err := run(ctx, cfg, afterUpdate); err != nil {
			t.Fatal(err)
		}
		month, err := readCurrent(cfg.dataDir)
		if err != nil {
			t.Fatal(err)
		}
		if month.RatingsUpdate != "2026-10-13" {
			t.Errorf("RatingsUpdate = %q", month.RatingsUpdate)
		}
		if !slices.Equal(month.Locations, []string{"US", "US-AL"}) {
			t.Errorf("Locations = %v", month.Locations)
		}
		var al LocationFile
		if err := readJSON(filepath.Join(cfg.dataDir, "current", "US-AL.json"), &al); err != nil {
			t.Fatal(err)
		}
		if al.TotalPlayers != 450 || al.Divisions["MPO"].Total != 150 {
			t.Errorf("US-AL = total %d, MPO %d", al.TotalPlayers, al.Divisions["MPO"].Total)
		}
		if month.PlayersFetched != 450 {
			t.Errorf("PlayersFetched = %d, want 450", month.PlayersFetched)
		}
		if month.TotalPlayers != 450 {
			t.Errorf("TotalPlayers = %d, want 450", month.TotalPlayers)
		}
		// Odd players played MA1 in 2025 and 2026; multiples of 3 played MPO
		// in 2026. The non-active FPO player is dropped.
		if len(month.Divisions) != 2 || month.Divisions["MA1"].Total != 225 ||
			month.Divisions["MPO"].Total != 150 || month.Divisions["MPO"].Ratings[900] != 150 {
			t.Errorf("Divisions = %+v", month.Divisions)
		}
		if err := run(ctx, cfg, afterUpdate.Add(24*time.Hour)); !errors.Is(err, errSkipped) {
			t.Errorf("second run err = %v, want skipped", err)
		}
	})

	t.Run("max pages is a dry run", func(t *testing.T) {
		cfg := testConfig(t, 450)
		cfg.maxPages = 1
		cfg.dryRun = true
		if err := run(ctx, cfg, afterUpdate); !errors.Is(err, errSkipped) {
			t.Fatalf("err = %v, want skipped", err)
		}
		if _, err := os.Stat(currentPath(cfg.dataDir)); !os.IsNotExist(err) {
			t.Error("dry run wrote a file")
		}
	})

	t.Run("not published skips before the division pass", func(t *testing.T) {
		f := &fakePDGA{total: 10}
		cfg := testConfig(t, 10)
		srv := httptest.NewServer(f)
		t.Cleanup(srv.Close)
		cfg.baseURL = srv.URL
		nextMonth := time.Date(2026, 11, 10, 17, 0, 0, 0, time.UTC)
		if err := run(ctx, cfg, nextMonth); !errors.Is(err, errSkipped) {
			t.Fatalf("err = %v, want skipped", err)
		}
		if got := f.statsCalls.Load(); got != 0 {
			t.Errorf("stats calls = %d, want 0", got)
		}
	})

	t.Run("large drop in fetched records fails", func(t *testing.T) {
		cfg := testConfig(t, 450)
		prev := Summary{Ratings: map[int]int{900: 1000}, Total: 1000, Fetched: 1000}
		if err := writeCurrent(cfg.dataDir, date("2026-09-08"), afterUpdate, prev); err != nil {
			t.Fatal(err)
		}
		err := run(ctx, cfg, afterUpdate)
		if err == nil || errors.Is(err, errSkipped) {
			t.Fatalf("err = %v, want failure", err)
		}
	})

	t.Run("new month replaces the previous snapshot", func(t *testing.T) {
		cfg := testConfig(t, 450)
		prev := Summary{Ratings: map[int]int{900: 450}, Total: 450, Fetched: 450}
		if err := writeCurrent(cfg.dataDir, date("2026-09-08"), afterUpdate, prev); err != nil {
			t.Fatal(err)
		}
		if err := run(ctx, cfg, afterUpdate); err != nil {
			t.Fatal(err)
		}
		month, err := readCurrent(cfg.dataDir)
		if err != nil || month.RatingsUpdate != "2026-10-13" {
			t.Errorf("current = %q, %v; want 2026-10-13", month.RatingsUpdate, err)
		}
	})

	t.Run("missing credentials fails", func(t *testing.T) {
		cfg := testConfig(t, 10)
		t.Setenv("PDGA_USERNAME", "")
		err := run(ctx, cfg, afterUpdate)
		if err == nil || errors.Is(err, errSkipped) {
			t.Fatalf("err = %v, want failure", err)
		}
	})
}
