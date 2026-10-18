package main

import "time"

const activeWindowMonths = 12

func secondTuesday(year int, month time.Month) time.Time {
	first := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	offset := (int(time.Tuesday) - int(first.Weekday()) + 7) % 7
	return first.AddDate(0, 0, offset+7)
}

func currentUpdate(now time.Time) (update time.Time, happened bool) {
	now = now.UTC()
	update = secondTuesday(now.Year(), now.Month())
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	return update, !today.Before(update)
}

func activeCutoff(update time.Time) time.Time {
	// Start from the 1st so AddDate can't overflow into the next month.
	first := time.Date(update.Year(), update.Month(), 1, 0, 0, 0, 0, time.UTC)
	earlier := first.AddDate(0, -activeWindowMonths, 0)
	return secondTuesday(earlier.Year(), earlier.Month())
}

func monthKey(update time.Time) string {
	return update.Format("2006-01")
}

func divisionYears(update time.Time) []int {
	return []int{update.Year() - 1, update.Year()}
}
