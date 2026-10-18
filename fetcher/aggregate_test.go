package main

import (
	"maps"
	"testing"
)

func player(number string, rating, effective *string) Player {
	return Player{PDGANumber: number, Rating: rating, RatingEffectiveDate: effective}
}

func TestSummarizeActiveFilter(t *testing.T) {
	update := date("2026-10-13")
	players := map[string]Player{
		"1":  player("1", new("900"), new("2026-10-13")),
		"2":  player("2", new("900"), new("2026-07-14")),
		"3":  player("3", new("950"), new("2025-11-11")),
		"4":  player("4", new("950"), new("2025-10-14")),
		"5":  player("5", nil, new("2026-10-13")),
		"6":  player("6", new("800"), nil),
		"7":  player("7", new("800"), new("2013-05-21")),
		"8":  player("8", new("abc"), new("2026-10-13")),
		"9":  player("9", new("800"), new("not-a-date")),
		"10": player("10", new("1060"), new("2026-10-27")),
	}

	got := summarize(players, update)

	want := map[int]int{900: 2, 950: 1, 1060: 1}
	if !maps.Equal(got.Ratings, want) {
		t.Errorf("Ratings = %v, want %v", got.Ratings, want)
	}
	if got.Total != 4 {
		t.Errorf("Total = %d, want 4", got.Total)
	}
	if got.Malformed != 2 {
		t.Errorf("Malformed = %d, want 2", got.Malformed)
	}
	if !got.Published {
		t.Error("Published = false, want true")
	}
}

func TestSummarizePublished(t *testing.T) {
	update := date("2026-10-13")
	tests := []struct {
		name    string
		players map[string]Player
		want    bool
	}{
		{"only older dates", map[string]Player{
			"1": player("1", new("900"), new("2026-09-08")),
		}, false},
		{"expired member updated", map[string]Player{
			"1": player("1", nil, new("2026-10-13")),
		}, true},
		{"preliminary rating after update", map[string]Player{
			"1": player("1", new("700"), new("2026-10-14")),
		}, true},
		{"no players", map[string]Player{}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := summarize(tt.players, update).Published; got != tt.want {
				t.Errorf("Published = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestSummarizeExcludesZero(t *testing.T) {
	players := map[string]Player{
		"1": player("1", new("0"), new("2026-10-13")),
		"2": player("2", new("7"), new("2026-10-13")),
	}
	got := summarize(players, date("2026-10-13"))
	if got.Zero != 1 || got.Total != 1 || got.Ratings[7] != 1 || got.Ratings[0] != 0 {
		t.Errorf("summary = %+v", got)
	}
}

func TestDivisionCounts(t *testing.T) {
	active := map[string]int{"1": 900, "2": 950, "3": 900}
	d := newDivisionTracker(active)
	for _, row := range []PlayerStat{
		{"1", "2025", "MA1"},
		{"1", "2026", "MA1"}, // same division in both years counts once
		{"1", "2026", "MPO"}, // second division counts too
		{"2", "2026", "MPO"},
		{"3", "2025", "MA1"},
		{"4", "2026", "MA1"}, // not active
		{"2", "2026", ""},    // missing code
	} {
		d.add(row)
	}

	got := d.counts()
	if len(got) != 2 {
		t.Fatalf("divisions = %v, want MA1 and MPO", got)
	}
	if ma1 := got["MA1"]; ma1.Total != 2 || !maps.Equal(ma1.Ratings, map[int]int{900: 2}) {
		t.Errorf("MA1 = %+v", ma1)
	}
	if mpo := got["MPO"]; mpo.Total != 2 || !maps.Equal(mpo.Ratings, map[int]int{900: 1, 950: 1}) {
		t.Errorf("MPO = %+v", mpo)
	}
}

func TestSummarizeActiveMap(t *testing.T) {
	players := map[string]Player{
		"1": player("1", new("900"), new("2026-10-13")),
		"2": player("2", new("0"), new("2026-10-13")),
		"3": player("3", nil, new("2026-10-13")),
	}
	got := summarize(players, date("2026-10-13")).Active
	if !maps.Equal(got, map[string]int{"1": 900}) {
		t.Errorf("Active = %v, want only player 1", got)
	}
}
