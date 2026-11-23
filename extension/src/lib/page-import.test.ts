import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { loadDocument } from './fixtures.test-helper';
import { importFromPage } from './page-import';
import { eventStore } from './storage';

// The trimmed fixtures list the player as PDGA #1.
describe('importFromPage', () => {
	beforeEach(() => fakeBrowser.reset());

	it('saves the rounds, then updates the same event on a second import', async () => {
		const doc = loadDocument('event-league-active.html');
		expect(await importFromPage(doc, 108060, '1')).toEqual({
			ok: true,
			rounds: 6,
			updated: false,
			localOnly: false
		});
		expect(await importFromPage(doc, 108060, '1')).toMatchObject({ ok: true, updated: true });

		const { events } = await eventStore('1').load();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ id: '1-108060', pdgaEventId: 108060, kind: 'league' });
	});

	it("keeps the player's other events", async () => {
		const store = eventStore('1');
		await store.load();
		await store.save([
			{ id: 'manual', kind: 'tournament', name: 'Hand entered', endDate: null, rounds: [] }
		]);
		await importFromPage(loadDocument('event-tournament.html'), 89239, '1');
		const { events } = await eventStore('1').load();
		expect(events.map((event) => event.id)).toEqual(['manual', '1-89239']);
	});

	it('saves nothing when the player has no rated rounds', async () => {
		const result = await importFromPage(loadDocument('event-doubles.html'), 105129, '1');
		expect(result).toMatchObject({ ok: false });
		expect(await importFromPage(loadDocument('event-doubles.html'), 105129, '2')).toEqual({
			ok: false,
			error: "PDGA #2 isn't in this event's results."
		});
		expect(Object.keys(await fakeBrowser.storage.sync.get())).toEqual([]);
	});
});
