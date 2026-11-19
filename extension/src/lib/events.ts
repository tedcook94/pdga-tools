export type EventKind = 'tournament' | 'league';

/** A round the player added by hand. Fields stay null until filled in. */
export interface AddedRound {
	id: string;
	date: string | null;
	rating: number | null;
	/** Holes in the layout. Defaults to 18. */
	holes?: number;
	/** The event's own round number, which skips missed weeks. Defaults to the position. */
	number?: number;
}

/** A tournament or league the player added by hand. */
export interface AddedEvent {
	id: string;
	kind: EventKind;
	name: string;
	/** Required for leagues, which report every round when the league ends. Unused for tournaments. */
	endDate: string | null;
	rounds: AddedRound[];
}

export const MIN_RATING = 0;
export const MAX_RATING = 1300;

/**
 * The date that decides which ratings update the event lands in: the league's
 * end date, or the tournament's last round date. Each round still keeps its
 * own date for the rating window.
 */
export function eventDate(event: AddedEvent): string | null {
	if (event.kind === 'league') return event.endDate;
	const dates = event.rounds.flatMap((round) => round.date ?? []);
	if (dates.length === 0) return null;
	return dates.reduce((latest, date) => (date > latest ? date : latest));
}

/** Lists what's missing or wrong with an event. Empty means it can be projected. */
export function validateEvent(event: AddedEvent): string[] {
	const problems: string[] = [];
	if (event.kind === 'league' && !event.endDate) problems.push('A league needs an end date.');
	if (event.rounds.length === 0) problems.push('Add at least one round.');
	if (event.rounds.some((round) => !round.date)) problems.push('Every round needs a date.');

	const { endDate } = event;
	if (
		event.kind === 'league' &&
		endDate &&
		event.rounds.some((round) => round.date && round.date > endDate)
	) {
		problems.push("Round dates can't be after the league's end date.");
	}

	const badRating = event.rounds.some(
		({ rating }) =>
			rating === null || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING
	);
	if (badRating) {
		problems.push(`Every round needs a whole-number rating from ${MIN_RATING} to ${MAX_RATING}.`);
	}
	const badHoles = event.rounds.some(
		({ holes }) => holes !== undefined && (!Number.isInteger(holes) || holes < 1)
	);
	if (badHoles) problems.push('Hole counts must be whole numbers above 0.');

	const numbers = event.rounds.map(roundNumber);
	if (numbers.some((number) => !Number.isInteger(number) || number < 1)) {
		problems.push('Round numbers must be whole numbers above 0.');
	} else if (new Set(numbers).size < numbers.length) {
		problems.push('Round numbers must be different.');
	}
	return problems;
}

/** The round's number as shown: its own, or its position in the event. */
export function roundNumber(round: AddedRound, index: number): number {
	return round.number ?? index + 1;
}
