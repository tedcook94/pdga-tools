// Dates are ISO strings (YYYY-MM-DD) and all arithmetic is done in UTC, so the
// browser's time zone can never shift a date by a day.

const DAY_MS = 86_400_000;

function parts(iso: string): [year: number, month: number, day: number] {
	const [year, month, day] = iso.split('-').map(Number);
	return [year!, month!, day!];
}

function toIso(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Returns the ISO date `days` days after `iso` (negative for before). */
export function addDays(iso: string, days: number): string {
	const [year, month, day] = parts(iso);
	return toIso(Date.UTC(year, month - 1, day) + days * DAY_MS);
}

/** Returns the ISO date `months` months before `iso`, clamped to the end of shorter months. */
export function monthsBefore(iso: string, months: number): string {
	const [year, month, day] = parts(iso);
	const target = new Date(Date.UTC(year, month - 1 - months, 1));
	const lastDay = new Date(
		Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
	).getUTCDate();
	target.setUTCDate(Math.min(day, lastDay));
	return target.toISOString().slice(0, 10);
}

/** A monthly ratings update and the last round date it includes. */
export interface RatingsUpdate {
	date: string;
	cutoff: string;
}

/** The ratings update for a month: the second Tuesday, with a cutoff on the Sunday before. */
export function ratingsUpdate(year: number, month: number): RatingsUpdate {
	const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
	const firstTuesday = 1 + ((2 - firstWeekday + 7) % 7);
	const date = toIso(Date.UTC(year, month - 1, firstTuesday + 7));
	return { date, cutoff: addDays(date, -2) };
}

/** The first ratings update whose cutoff is on or after `date`. */
export function updateFor(date: string): RatingsUpdate {
	const [year, month] = parts(date);
	const sameMonth = ratingsUpdate(year, month);
	if (date <= sameMonth.cutoff) return sameMonth;
	return month === 12 ? ratingsUpdate(year + 1, 1) : ratingsUpdate(year, month + 1);
}

/** The ratings update published on `date`, or null if no update falls on that day. */
export function updateOn(date: string): RatingsUpdate | null {
	const [year, month] = parts(date);
	const update = ratingsUpdate(year, month);
	return update.date === date ? update : null;
}
