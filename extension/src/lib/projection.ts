import { eventDate, validateEvent, type AddedEvent, type AddedRound } from './events';
import { calculateRating, type RatingResult } from './rating';
import type { PageRound, RatingsPage } from './ratings-page';
import { addDays, updateFor, updateOn, type RatingsUpdate } from './schedule';

/** A round from the ratings detail table, dated by `pageRoundDate`. */
export interface PageCalcRound {
	source: 'page';
	date: string;
	rating: number;
	holes: number;
	eventKey: string;
	page: PageRound;
}

/** A round the player added, dated by when it was played. */
export interface AddedCalcRound {
	source: 'added';
	date: string;
	/** The update it lands in, decided by the league end or last tournament round. */
	update: RatingsUpdate;
	rating: number;
	holes: number;
	eventKey: string;
	event: AddedEvent;
	round: AddedRound;
}

export type CalcRound = PageCalcRound | AddedCalcRound;

export interface ProjectedUpdate {
	update: RatingsUpdate;
	/** PDGA's current rating moved by how much our calculation moves. */
	rating: number;
	/** Change from the previous update, starting from PDGA's current rating. */
	change: number;
	/** Added rounds first counted in this update. */
	added: AddedCalcRound[];
	/** Rounds counted in the previous update that fall outside this window. */
	agedOut: CalcRound[];
	result: RatingResult<CalcRound>;
}

export interface Projection {
	/** The update the page reflects, from its "as of" date. */
	current: RatingsUpdate | null;
	/** Our recalculation of the current rating from the page alone. */
	baseline: RatingResult<CalcRound>;
	/** Events already counted in the current rating, so left out of the projection. */
	counted: AddedEvent[];
	/** Events that can't be projected yet, with what's wrong. */
	invalid: { event: AddedEvent; problems: string[] }[];
	/** Upcoming updates that change, in date order. */
	updates: ProjectedUpdate[];
}

// Only rounds PDGA evaluated: the rest are older than the window, which only
// moves forward. This also sidesteps the hidden league round dates that decide
// which league rounds made the current window.
export function pageCalcRounds(page: RatingsPage): PageCalcRound[] {
	const rounds = page.rounds
		.filter((round) => round.evaluated)
		.map(
			(round): PageCalcRound => ({
				source: 'page',
				date: pageRoundDate(round),
				rating: round.rating,
				holes: round.holes,
				eventKey: pageEventKey(round),
				page: round
			})
		);
	// Skipped league weeks can put an estimate before the window, but PDGA
	// evaluating the round proves it was played inside it.
	const { windowStart } = calculateRating(rounds);
	if (!windowStart) return rounds;
	return rounds.map((round) => (round.date < windowStart ? { ...round, date: windowStart } : round));
}

const LEAGUE_TIER = 'L';

/**
 * The date a page round was played, which decides doubling and aging out.
 * League rounds show only the league's date range, so round N is estimated at
 * N − 1 weeks after the start, capped at the end. Round numbers are the
 * league's own, so missed rounds don't shift the estimate; skipped weeks make
 * it early. Rounds like "Finals" keep the end date.
 */
export function pageRoundDate(round: PageRound): string {
	const number = Number(round.round);
	if (round.tier !== LEAGUE_TIER || !Number.isInteger(number) || number < 1) {
		return round.endDate;
	}
	const estimate = addDays(round.startDate, (number - 1) * 7);
	return estimate < round.endDate ? estimate : round.endDate;
}

/** Groups page rounds by event; the name and dates stand in when a row has no event link. */
export function pageEventKey(round: PageRound): string {
	return round.eventId === null
		? `page:${round.eventName}:${round.startDate}`
		: `page:${round.eventId}`;
}

/** Projects the rating for each upcoming update that includes added rounds. */
export function project(page: RatingsPage, events: readonly AddedEvent[]): Projection {
	const current = page.ratingDate ? updateOn(page.ratingDate) : null;
	const base = pageCalcRounds(page);
	const baseline = calculateRating<CalcRound>(base);

	const counted: AddedEvent[] = [];
	const invalid: Projection['invalid'] = [];
	const pending: { update: RatingsUpdate; rounds: AddedCalcRound[] }[] = [];

	for (const event of events) {
		const problems = validateEvent(event);
		const date = eventDate(event);
		if (problems.length > 0 || !date) {
			invalid.push({ event, problems });
			continue;
		}
		if (current && date <= current.cutoff) {
			counted.push(event);
			continue;
		}
		const update = updateFor(date);
		const rounds = event.rounds.map(
			(round): AddedCalcRound => ({
				source: 'added',
				date: round.date!,
				update,
				rating: round.rating!,
				holes: round.holes ?? 18,
				eventKey: `added:${event.id}`,
				event,
				round
			})
		);
		const group = pending.find((g) => g.update.date === update.date);
		if (group) group.rounds.push(...rounds);
		else pending.push({ update, rounds });
	}

	pending.sort((a, b) => a.update.date.localeCompare(b.update.date));

	// Our rating can still miss PDGA's by 1–2 (see calculateRating), and that
	// error is mostly the same before and after an update, so moving PDGA's
	// rating by our change cancels it.
	const anchor =
		page.rating !== null && baseline.exact !== null
			? { rating: page.rating, exact: baseline.exact }
			: null;

	const updates: ProjectedUpdate[] = [];
	let rounds: CalcRound[] = base;
	let previous = baseline;
	let previousRating = page.rating ?? baseline.rating;
	for (const { update, rounds: added } of pending) {
		// Added rounds go first so they count as newest among same-day rounds.
		rounds = [...added, ...rounds];
		const result = calculateRating(rounds);
		const evaluated = new Set(result.evaluated);
		const rating = anchor
			? Math.round(anchor.rating + result.exact! - anchor.exact)
			: result.rating!;
		updates.push({
			update,
			rating,
			change: previousRating === null ? 0 : rating - previousRating,
			added,
			agedOut: previous.evaluated.filter((round) => !evaluated.has(round)),
			result
		});
		previous = result;
		previousRating = rating;
	}

	return { current, baseline, counted, invalid, updates };
}
