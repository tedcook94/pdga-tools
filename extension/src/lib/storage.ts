import { storage } from 'wxt/utils/storage';
import type { AddedEvent } from './events';

/** The PDGA number in a ratings detail URL such as /player/12345/details. */
export function pdgaNumber(pathname: string): string | null {
	return pathname.match(/^\/player\/(\d+)\/details\/?$/)?.[1] ?? null;
}

export interface SaveResult {
	/** Sync failed (usually its quota), so the events are only on this device. */
	localOnly: boolean;
}

export interface LoadResult extends SaveResult {
	events: AddedEvent[];
}

const playerKey = (player: string) => `sync:player:${player}` as const;
const eventKey = (id: string) => `sync:event:${id}` as const;
const fallbackKey = (player: string) => `local:events:${player}` as const;

/**
 * Saves one player's events to sync storage so they follow the browser
 * account. Each event is its own item: sync caps items at 8 KB, and when two
 * devices edit at once the last write wins per item, so only an event edited
 * on both can lose changes.
 */
export function eventStore(player: string) {
	// What sync holds for this player, so saves write only changed events and
	// remove deleted ones.
	let synced = new Map<string, string>();

	async function load(): Promise<LoadResult> {
		const ids = (await storage.getItem<string[]>(playerKey(player))) ?? [];
		const items = await storage.getItems(ids.map(eventKey));
		// An id can arrive before its event item finishes syncing.
		const events = items.flatMap(({ value }) => (value ? [value as AddedEvent] : []));
		synced = new Map(events.map((event) => [event.id, JSON.stringify(event)]));

		// A fallback copy exists only while sync is failing, so it's the newest.
		const fallback = await storage.getItem<AddedEvent[]>(fallbackKey(player));
		return fallback ? { events: fallback, localOnly: true } : { events, localOnly: false };
	}

	async function write(events: AddedEvent[]): Promise<SaveResult> {
		const json = new Map(events.map((event) => [event.id, JSON.stringify(event)]));
		const changed = events.filter((event) => synced.get(event.id) !== json.get(event.id));
		const removed = [...synced.keys()].filter((id) => !json.has(id));
		try {
			await storage.setItems([
				...changed.map((event) => ({ key: eventKey(event.id), value: event })),
				{ key: playerKey(player), value: events.map((event) => event.id) }
			]);
			if (removed.length > 0) await storage.removeItems(removed.map(eventKey));
			synced = json;
			await storage.removeItem(fallbackKey(player));
			return { localOnly: false };
		} catch {
			await storage.setItem(fallbackKey(player), events);
			return { localOnly: true };
		}
	}

	// Saves run one at a time; overlapping ones could leave `synced` describing
	// an older write than the one that landed last.
	let queue: Promise<unknown> = Promise.resolve();
	function save(events: AddedEvent[]): Promise<SaveResult> {
		const result = queue.then(() => write(events));
		queue = result;
		return result;
	}

	return { load, save };
}

// Shared by every player: it's a preference about the page, not the player.
const collapsedItem = storage.defineItem<boolean>('sync:panelCollapsed', { fallback: false });

export function loadCollapsed(): Promise<boolean> {
	return collapsedItem.getValue();
}

export async function saveCollapsed(collapsed: boolean): Promise<void> {
	// Losing this preference isn't worth surfacing.
	await collapsedItem.setValue(collapsed).catch(() => {});
}
