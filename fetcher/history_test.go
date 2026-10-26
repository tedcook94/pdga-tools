package main

import (
	"maps"
	"testing"
)

func TestYearTracker(t *testing.T) {
	y := newYearTracker()
	for _, row := range []PlayerStat{
		{PDGANumber: "1", DivisionCode: "MA3", Rating: new("864")},
		{PDGANumber: "1", DivisionCode: "MA4", Rating: new("864")}, // same player, second division
		{PDGANumber: "2", DivisionCode: "MPO", Rating: new("1058")},
		{PDGANumber: "3", DivisionCode: "MA1", Rating: nil},
		{PDGANumber: "4", DivisionCode: "MA1", Rating: new("0")},
		{PDGANumber: "5", DivisionCode: "MA1", Rating: new("abc")},
	} {
		y.add(row)
	}
	got := y.counts()
	if got.Total != 2 || !maps.Equal(got.Ratings, map[int]int{864: 1, 1058: 1}) {
		t.Errorf("counts = %+v", got)
	}
}

func TestWriteHistorySkipsEmpty(t *testing.T) {
	dir := t.TempDir()
	ok, err := writeHistory(dir, 2027, date("2027-01-12"), Counts{Ratings: map[int]int{}})
	if err != nil || ok {
		t.Fatalf("writeHistory = %v, %v; want skipped", ok, err)
	}
	if exists, _ := historyExists(dir, 2027); exists {
		t.Error("empty year was written")
	}
}

func TestParseYears(t *testing.T) {
	tests := []struct {
		in       string
		from, to int
		ok       bool
	}{
		{"2000-2024", 2000, 2024, true},
		{"2024", 2024, 2024, true},
		{"2024-2000", 0, 0, false},
		{"abc", 0, 0, false},
		{"2000-", 0, 0, false},
	}
	for _, tt := range tests {
		from, to, err := parseYears(tt.in)
		if (err == nil) != tt.ok || from != tt.from || to != tt.to {
			t.Errorf("parseYears(%q) = %d, %d, %v", tt.in, from, to, err)
		}
	}
}
