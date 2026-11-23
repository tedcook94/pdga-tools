import {
	parseEventPage,
	parseEventRounds,
	type EventPage,
	type EventPageRound
} from './event-page';

export type FetchEventResult =
	| { ok: true; page: EventPage; rounds: EventPageRound[] }
	| { ok: false; error: string };

export function eventPageUrl(pdgaEventId: number): string {
	return `https://www.pdga.com/tour/event/${pdgaEventId}`;
}

const TIMEOUT_MS = 15_000;

/**
 * Loads one event page and reads a player's rated rounds from it. Only runs
 * when the player asks for an import or refresh: one request, no retries.
 */
export async function fetchEvent(
	pdgaEventId: number,
	player: string,
	fetcher: typeof fetch = fetch
): Promise<FetchEventResult> {
	let html: string;
	try {
		const response = await fetcher(eventPageUrl(pdgaEventId), {
			credentials: 'include',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
		if (!response.ok) {
			return {
				ok: false,
				error:
					`pdga.com didn't return the event page (error ${response.status}). ` +
					'Check the event ID and try again.'
			};
		}
		html = await response.text();
	} catch {
		return {
			ok: false,
			error: "Couldn't reach pdga.com. Check your connection and try again."
		};
	}

	// Parsed documents are inert: their scripts don't run and nothing loads.
	return readEvent(new DOMParser().parseFromString(html, 'text/html'), player);
}

/** Reads a player's rated rounds from an event page, fetched or open. */
export function readEvent(doc: ParentNode, player: string): FetchEventResult {
	const page = parseEventPage(doc);
	if (!page) return { ok: false, error: "That page doesn't look like a PDGA event page." };

	const rounds = parseEventRounds(doc, page, player);
	if (!rounds) return { ok: false, error: `PDGA #${player} isn't in this event's results.` };
	if (rounds.length === 0) {
		return {
			ok: false,
			error:
				`None of PDGA #${player}'s rounds in this event are rated yet. ` +
				"Doubles and some other formats aren't rated."
		};
	}
	return { ok: true, page, rounds };
}
