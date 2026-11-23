import type { EventPage, EventPageRound } from './event-page';
import type { AddedEvent, AddedRound } from './events';

/**
 * The id of an event imported from PDGA. It's the same on every device, so
 * importing one event on two synced browsers can't create two copies.
 */
export function importedEventId(player: string, pdgaEventId: number): string {
	return `${player}-${pdgaEventId}`;
}

/**
 * Adds an imported event to the list, or replaces an earlier import of the
 * same event where it sits. Everything comes from the event page except
 * league round dates the player already had: those are estimates the player
 * may have fixed for a skipped week, so they're kept by round number.
 */
export function importEvent(
	events: readonly AddedEvent[],
	player: string,
	pdgaEventId: number,
	page: EventPage,
	rounds: readonly EventPageRound[]
): AddedEvent[] {
	const id = importedEventId(player, pdgaEventId);
	const previous = events.find((event) => event.id === id);
	const league = page.kind === 'league';
	const previousRounds = new Map(
		previous?.rounds.flatMap((round) => (round.number ? [[round.number, round]] : []))
	);

	const imported: AddedEvent = {
		id,
		kind: page.kind,
		name: page.name,
		endDate: league ? page.endDate : null,
		pdgaEventId,
		rounds: rounds.map(({ number, date, rating, holes }): AddedRound => {
			const before = previousRounds.get(number);
			const kept = league && before?.date && before.date <= page.endDate ? before.date : null;
			return {
				// Keeping ids keeps the editor's rows in place across a refresh.
				id: before?.id ?? crypto.randomUUID(),
				number,
				date: kept ?? date,
				rating,
				holes
			};
		})
	};

	return previous
		? events.map((event) => (event.id === id ? imported : event))
		: [...events, imported];
}
