package main

import (
	"testing"
	"time"
)

func date(s string) time.Time {
	t, err := time.Parse(time.DateOnly, s)
	if err != nil {
		panic(err)
	}
	return t
}

func TestSecondTuesdayMatchesPublishedSchedule(t *testing.T) {
	// Dates from https://www.pdga.com/faq/ratings/when-updated.
	published := []string{
		"2026-09-08", "2026-10-13", "2026-11-10", "2026-12-08",
		"2027-01-12", "2027-02-09", "2027-03-09",
	}
	for _, want := range published {
		d := date(want)
		got := secondTuesday(d.Year(), d.Month())
		if !got.Equal(d) {
			t.Errorf("secondTuesday(%d, %s) = %s, want %s",
				d.Year(), d.Month(), got.Format(time.DateOnly), want)
		}
	}
}

func TestSecondTuesdayAlwaysInRange(t *testing.T) {
	for year := 2020; year <= 2035; year++ {
		for month := time.January; month <= time.December; month++ {
			got := secondTuesday(year, month)
			if got.Weekday() != time.Tuesday || got.Day() < 8 || got.Day() > 14 {
				t.Errorf("secondTuesday(%d, %s) = %s", year, month, got.Format(time.DateOnly))
			}
		}
	}
}

func TestCurrentUpdate(t *testing.T) {
	tests := []struct {
		now      time.Time
		wantDate string
		wantDue  bool
	}{
		{time.Date(2026, 10, 12, 23, 59, 0, 0, time.UTC), "2026-10-13", false},
		{time.Date(2026, 10, 13, 0, 0, 0, 0, time.UTC), "2026-10-13", true},
		{time.Date(2026, 10, 13, 17, 0, 0, 0, time.UTC), "2026-10-13", true},
		{time.Date(2026, 10, 31, 17, 0, 0, 0, time.UTC), "2026-10-13", true},
		{time.Date(2026, 11, 1, 17, 0, 0, 0, time.UTC), "2026-11-10", false},
		// 2026-10-12 20:00 in New York is already the 13th in UTC.
		{time.Date(2026, 10, 12, 20, 0, 0, 0, mustLoad(t, "America/New_York")), "2026-10-13", true},
	}
	for _, tt := range tests {
		got, due := currentUpdate(tt.now)
		if got.Format(time.DateOnly) != tt.wantDate || due != tt.wantDue {
			t.Errorf("currentUpdate(%s) = %s, %v; want %s, %v",
				tt.now, got.Format(time.DateOnly), due, tt.wantDate, tt.wantDue)
		}
	}
}

func TestActiveCutoff(t *testing.T) {
	tests := map[string]string{
		"2026-10-13": "2025-10-14",
		"2027-01-12": "2026-01-13",
		"2026-12-08": "2025-12-09",
	}
	for update, want := range tests {
		got := activeCutoff(date(update)).Format(time.DateOnly)
		if got != want {
			t.Errorf("activeCutoff(%s) = %s, want %s", update, got, want)
		}
	}
}

func TestMonthKey(t *testing.T) {
	if got := monthKey(date("2026-10-13")); got != "2026-10" {
		t.Errorf("monthKey = %q, want %q", got, "2026-10")
	}
}

func mustLoad(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Skipf("time zone %s unavailable: %v", name, err)
	}
	return loc
}
