package main

import (
	"strconv"
	"time"
)

type Player struct {
	PDGANumber          string  `json:"pdga_number"`
	Rating              *string `json:"rating"`
	RatingEffectiveDate *string `json:"rating_effective_date"`
	Country             string  `json:"country"`
	StateProv           string  `json:"state_prov"`
}

var subdivisionCountries = map[string]bool{"US": true, "CA": true}
var militaryStates = map[string]bool{"AA": true, "AE": true, "AP": true}

func locationKeys(p Player) []string {
	if p.Country == "" {
		return nil
	}
	// The API files Puerto Rico both as a country and as a US state; it's
	// listed once, as a country.
	if p.Country == "US" && p.StateProv == "PR" {
		return []string{"PR"}
	}
	keys := []string{p.Country}
	if subdivisionCountries[p.Country] && p.StateProv != "" && !militaryStates[p.StateProv] {
		keys = append(keys, p.Country+"-"+p.StateProv)
	}
	return keys
}

type PlayerStat struct {
	PDGANumber   string `json:"pdga_number"`
	Year         string `json:"year"`
	DivisionCode string `json:"division_code"`
}

type Counts struct {
	Total   int         `json:"total"`
	Ratings map[int]int `json:"ratings"`
}

type LocationCounts struct {
	Counts
	Divisions map[string]Counts `json:"divisions,omitempty"`
}

type Summary struct {
	Ratings         map[int]int
	Total           int
	Fetched         int
	Divisions       map[string]Counts
	Locations       map[string]LocationCounts
	Active          map[string]int
	ActiveLocations map[string][]string
	Published       bool
	Zero            int
	Malformed       int
}

func summarize(players map[string]Player, update time.Time) Summary {
	cutoff := activeCutoff(update)
	s := Summary{Ratings: map[int]int{}, Active: map[string]int{}, ActiveLocations: map[string][]string{}}

	for _, p := range players {
		if p.RatingEffectiveDate == nil {
			continue
		}
		effective, err := time.Parse(time.DateOnly, *p.RatingEffectiveDate)
		if err != nil {
			s.Malformed++
			continue
		}
		// Expired members still get new effective dates, so check publication
		// before filtering on rating.
		if !effective.Before(update) {
			s.Published = true
		}
		if p.Rating == nil || !effective.After(cutoff) {
			continue
		}
		rating, err := strconv.Atoi(*p.Rating)
		if err != nil {
			s.Malformed++
			continue
		}
		// The API reports 0 for some players; it isn't a real rating.
		if rating == 0 {
			s.Zero++
			continue
		}
		s.Ratings[rating]++
		s.Total++
		s.Active[p.PDGANumber] = rating
		if keys := locationKeys(p); keys != nil {
			s.ActiveLocations[p.PDGANumber] = keys
		}
	}
	return s
}

type divisionTracker struct {
	active map[string]int
	played map[string]map[string]bool
}

func newDivisionTracker(active map[string]int) *divisionTracker {
	return &divisionTracker{active: active, played: map[string]map[string]bool{}}
}

func (d *divisionTracker) add(row PlayerStat) {
	if _, ok := d.active[row.PDGANumber]; !ok || row.DivisionCode == "" {
		return
	}
	if d.played[row.PDGANumber] == nil {
		d.played[row.PDGANumber] = map[string]bool{}
	}
	d.played[row.PDGANumber][row.DivisionCode] = true
}

func (d *divisionTracker) counts() map[string]Counts {
	out := map[string]Counts{}
	for number, divisions := range d.played {
		rating := d.active[number]
		for code := range divisions {
			c, ok := out[code]
			if !ok {
				c = Counts{Ratings: map[int]int{}}
			}
			c.Total++
			c.Ratings[rating]++
			out[code] = c
		}
	}
	return out
}

func (d *divisionTracker) locationCounts(locations map[string][]string) map[string]LocationCounts {
	out := map[string]LocationCounts{}
	for number, keys := range locations {
		rating, ok := d.active[number]
		if !ok {
			continue
		}
		for _, key := range keys {
			loc, ok := out[key]
			if !ok {
				loc = LocationCounts{Counts: Counts{Ratings: map[int]int{}}, Divisions: map[string]Counts{}}
			}
			loc.Total++
			loc.Ratings[rating]++
			for code := range d.played[number] {
				c, ok := loc.Divisions[code]
				if !ok {
					c = Counts{Ratings: map[int]int{}}
				}
				c.Total++
				c.Ratings[rating]++
				loc.Divisions[code] = c
			}
			out[key] = loc
		}
	}
	return out
}
