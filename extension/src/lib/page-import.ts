import { readEvent } from './fetch-event';
import { importedEventId, importEvent } from './import';
import { eventStore } from './storage';

export type PageImportResult =
	| { ok: true; rounds: number; updated: boolean; localOnly: boolean }
	| { ok: false; error: string };

/**
 * Imports a player's rounds from the event page that's open into their saved
 * events. An open ratings page for that player picks the change up itself.
 */
export async function importFromPage(
	doc: ParentNode,
	pdgaEventId: number,
	player: string,
	store = eventStore(player)
): Promise<PageImportResult> {
	const result = readEvent(doc, player);
	if (!result.ok) return result;

	const { events } = await store.load();
	const updated = events.some((event) => event.id === importedEventId(player, pdgaEventId));
	const next = importEvent(events, player, pdgaEventId, result.page, result.rounds);
	const { localOnly } = await store.save(next);
	return { ok: true, rounds: result.rounds.length, updated, localOnly };
}
