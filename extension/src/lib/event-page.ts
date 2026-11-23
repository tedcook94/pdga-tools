import type { EventKind } from './events';
import { cellText, layoutHoles, parseDateRange, STANDARD_HOLES } from './ratings-page';
import { leagueRoundDate } from './schedule';

/** What the extension reads about an event from its pdga.com page. */
export interface EventPage {
	name: string;
	kind: EventKind;
	/** ISO date (YYYY-MM-DD). */
	startDate: string;
	/** ISO date (YYYY-MM-DD). */
	endDate: string;
}

/** One player's rated round on an event page. */
export interface EventPageRound {
	/** The event's own round number, so missed league weeks leave gaps. */
	number: number;
	/** ISO date. Estimated, since event pages only date the whole event. */
	date: string;
	rating: number;
	holes: number;
}

/**
 * The event ID in an ID, event page link or PDGA Live link, or null for
 * anything else.
 */
export function parseEventId(text: string): number | null {
	const input = text.trim();
	const id =
		input.match(/^[1-9]\d{0,8}$/)?.[0] ??
		input.match(
			/^(?:https?:\/\/)?(?:www\.)?pdga\.com\/(?:tour|live)\/event\/([1-9]\d{0,8})(?:[/?#].*)?$/i
		)?.[1];
	return id ? Number(id) : null;
}

/** Reads the event's details, or null if the page isn't an event page. */
export function parseEventPage(doc: ParentNode): EventPage | null {
	const name = doc.querySelector('#page-title')?.textContent?.trim();
	const info = doc.querySelector('.pane-tournament-event-info');
	const dateText = info?.querySelector('.tournament-date')?.textContent ?? '';
	const dates = parseDateRange(dateText.replace(/^\s*Date:\s*/, ''));
	if (!name || !dates) return null;

	const type = info?.querySelector('h4')?.textContent ?? '';
	return {
		name,
		kind: /\bleague\b/i.test(type) ? 'league' : 'tournament',
		startDate: dates.start,
		endDate: dates.end
	};
}

/**
 * Reads one player's rated rounds from an event page. Null means the player
 * isn't in the results; an empty list means none of their rounds are rated.
 */
export function parseEventRounds(
	doc: ParentNode,
	event: EventPage,
	player: string
): EventPageRound[] | null {
	const row = [...doc.querySelectorAll('table.results tbody tr')].find(
		(candidate) => cellText(candidate, 'pdga-number') === player
	);
	if (!row) return null;

	const headers = [...(row.closest('table')?.querySelectorAll('thead th.round') ?? [])];
	const ratings = [...row.querySelectorAll('td.round-rating')];
	const holesById = layoutHoles(doc);

	let previous = 0;
	return headers.flatMap((header, index) => {
		const labeled = header.textContent?.trim().match(/^Rd(\d+)$/)?.[1];
		// "Semis" and "Finals" follow the numbered rounds.
		const number = labeled ? Number(labeled) : previous + 1;
		previous = number;

		const rating = Number.parseInt(ratings[index]?.textContent ?? '', 10);
		if (Number.isNaN(rating)) return [];

		const layoutId = header.getAttribute('data-tooltip-content')?.replace(/^#/, '');
		return {
			number,
			date:
				event.kind === 'league' && labeled
					? leagueRoundDate(event.startDate, event.endDate, number)
					: event.endDate,
			rating,
			holes: (layoutId && holesById.get(layoutId)) || STANDARD_HOLES
		};
	});
}
