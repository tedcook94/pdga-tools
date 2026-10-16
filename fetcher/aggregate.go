package main

import (
	"strconv"
	"time"
)

type Player struct {
	PDGANumber          string  `json:"pdga_number"`
	Rating              *string `json:"rating"`
	RatingEffectiveDate *string `json:"rating_effective_date"`
}

type Summary struct {
	Ratings   map[int]int
	Total     int
	Published bool
	Zero      int
	Malformed int
}

func summarize(players map[string]Player, update time.Time) Summary {
	cutoff := activeCutoff(update)
	s := Summary{Ratings: map[int]int{}}

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
	}
	return s
}
