import { monthsBefore } from './schedule';

/** Anything with the date PDGA rates it on and a round rating. */
export interface RatedRound {
	date: string;
	rating: number;
	/** Holes in the layout. Defaults to 18. */
	holes?: number;
	/** Identifies the round's event, so rounds of one event can be told apart from others. */
	eventKey?: string;
}

export interface RatingResult<T extends RatedRound> {
	/** The rating PDGA would publish, or null with no rounds. */
	rating: number | null;
	/** The weighted average before rounding. */
	exact: number | null;
	/** Earliest date inside the rating window. */
	windowStart: string | null;
	/** Rounds inside the window, newest first. */
	evaluated: T[];
	/** Evaluated rounds that count, newest first. */
	used: T[];
	/** Evaluated rounds dropped as low outliers. */
	dropped: T[];
	/** Used rounds that count twice. */
	doubled: T[];
}

const WINDOW_MONTHS = 12;
const EXTENDED_WINDOW_MONTHS = 24;
const MIN_WINDOW_ROUNDS = 8;
const MIN_ROUNDS_TO_DOUBLE = 9;
const MIN_ROUNDS_TO_DROP = 7;
const STANDARD_HOLES = 18;
// Published round ratings are truncated from unrounded per-hole values, so the
// real ratings average half a point higher.
const TRUNCATION_OFFSET = 0.5;

function mean(values: number[]): number {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStandardDeviation(values: number[]): number {
	const average = mean(values);
	return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function dropCutoff(ratings: number[]): number {
	if (ratings.length < MIN_ROUNDS_TO_DROP) return -Infinity;
	const average = mean(ratings);
	// The lowest round is left out of the spread so a single blowup can't widen
	// it enough to save itself.
	const withoutLowest = [...ratings].sort((a, b) => a - b).slice(1);
	const spread = populationStandardDeviation(withoutLowest);
	return Math.max(average - 100, average - 2.5 * spread);
}

function pickDoubled<T extends RatedRound>(used: T[], count: number): T[] {
	const newest = used.slice(0, count);
	const boundaryKey = used[count - 1]?.eventKey;
	if (count === 0 || boundaryKey === undefined || used[count]?.eventKey !== boundaryKey) {
		return newest;
	}
	// When the cut splits an event, that event's best rounds are doubled.
	const outside = newest.filter((round) => round.eventKey !== boundaryKey);
	const best = used
		.filter((round) => round.eventKey === boundaryKey)
		.sort((a, b) => b.rating - a.rating);
	return [...outside, ...best.slice(0, count - outside.length)];
}

function weightedAverage(rounds: RatedRound[]): number {
	let total = 0;
	let weight = 0;
	for (const round of rounds) {
		const holes = (round.holes ?? STANDARD_HOLES) / STANDARD_HOLES;
		total += (round.rating + TRUNCATION_OFFSET) * holes;
		weight += holes;
	}
	return total / weight;
}

/**
 * Recreates PDGA's player rating from the ratings detail page. Expects only
 * the rounds PDGA evaluated plus added ones: league rounds have hidden real
 * dates, so the current window can't be rebuilt from the page.
 *
 * Sources: the PDGA ratings guide and FAQ, plus posts by Chuck Kennedy of the
 * PDGA ratings team on the archived discussion board (t-22332, t-24143,
 * t-26808, t-28825). Checked against 34 saved pages: dropped rounds match for
 * all 34, and the rating matches exactly for 30 and within 1 for the rest.
 * That relies on callers estimating league round dates (see pageRoundDate);
 * with league end dates it was 27 exact and within 2.
 *
 * 1. Window: rounds on or after 12 months before the latest round, or 24 months
 *    when 12 months holds fewer than 8 rounds.
 * 2. Outliers: with 7 or more rounds, one pass drops rounds below the higher of
 *    average − 100 and average − 2.5 standard deviations. The average covers
 *    every round; the standard deviation (population) leaves out the lowest.
 * 3. Doubling: with 9 or more evaluated rounds, one used round per 4 evaluated
 *    (rounded down) counts twice, newest first. If that cut splits an event,
 *    the event's best rounds are doubled instead of its newest.
 * 4. Average: each round weighs holes ÷ 18, and every rating gets +0.5 to undo
 *    the truncation of published round ratings.
 */
export function calculateRating<T extends RatedRound>(rounds: readonly T[]): RatingResult<T> {
	// Stable sort keeps the caller's order for same-day rounds, which decides
	// which of them are doubled.
	const newestFirst = [...rounds].sort((a, b) => b.date.localeCompare(a.date));
	const latest = newestFirst[0];
	if (!latest) {
		return {
			rating: null,
			exact: null,
			windowStart: null,
			evaluated: [],
			used: [],
			dropped: [],
			doubled: []
		};
	}

	let windowStart = monthsBefore(latest.date, WINDOW_MONTHS);
	let evaluated = newestFirst.filter((round) => round.date >= windowStart);
	if (evaluated.length < MIN_WINDOW_ROUNDS) {
		windowStart = monthsBefore(latest.date, EXTENDED_WINDOW_MONTHS);
		evaluated = newestFirst.filter((round) => round.date >= windowStart);
	}

	const cutoff = dropCutoff(evaluated.map((round) => round.rating));
	const used = evaluated.filter((round) => round.rating >= cutoff);
	const dropped = evaluated.filter((round) => round.rating < cutoff);

	const doubleCount =
		evaluated.length >= MIN_ROUNDS_TO_DOUBLE ? Math.floor(evaluated.length / 4) : 0;
	const doubled = pickDoubled(used, doubleCount);

	const exact = weightedAverage([...used, ...doubled]);
	return { rating: Math.round(exact), exact, windowStart, evaluated, used, dropped, doubled };
}
