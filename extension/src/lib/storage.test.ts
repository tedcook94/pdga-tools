import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { AddedEvent } from './events';
import { eventStore, loadCollapsed, pdgaNumber, saveCollapsed } from './storage';

describe('pdgaNumber', () => {
	it('reads the number from a ratings detail path', () => {
		expect(pdgaNumber('/player/12345/details')).toBe('12345');
		expect(pdgaNumber('/player/12345/details/')).toBe('12345');
	});

	it('rejects other paths', () => {
		expect(pdgaNumber('/player/12345')).toBeNull();
		expect(pdgaNumber('/player/abc/details')).toBeNull();
	});
});

const event = (id: string, rating = 940): AddedEvent => ({
	id,
	kind: 'league',
	name: `League ${id}`,
	endDate: '2026-12-12',
	rounds: [{ id: `${id}1`, date: '2026-11-14', rating, holes: 21, number: 2 }]
});

const syncKeys = async () => Object.keys(await fakeBrowser.storage.sync.get()).sort();

describe('eventStore', () => {
	beforeEach(() => {
		fakeBrowser.reset();
		vi.restoreAllMocks();
	});

	it('starts empty', async () => {
		expect(await eventStore('1').load()).toEqual({ events: [], localOnly: false });
	});

	it('round-trips events through sync, separately per player', async () => {
		expect(await eventStore('1').save([event('a'), event('b')])).toEqual({ localOnly: false });
		expect(await eventStore('1').load()).toEqual({
			events: [event('a'), event('b')],
			localOnly: false
		});
		expect((await eventStore('2').load()).events).toEqual([]);
		expect(await syncKeys()).toEqual(['event:a', 'event:b', 'player:1']);
	});

	it('removes the items of deleted events', async () => {
		const store = eventStore('1');
		await store.load();
		await store.save([event('a'), event('b')]);
		await store.save([event('b')]);
		expect(await syncKeys()).toEqual(['event:b', 'player:1']);
	});

	it('writes only events that changed', async () => {
		const store = eventStore('1');
		await store.load();
		await store.save([event('a'), event('b')]);
		const set = vi.spyOn(fakeBrowser.storage.sync, 'set');
		await store.save([event('a'), event('b', 990)]);
		expect(Object.keys(set.mock.calls[0]![0] as object).sort()).toEqual(['event:b', 'player:1']);
	});

	it('runs overlapping saves in order', async () => {
		const store = eventStore('1');
		await store.load();
		await Promise.all([store.save([event('a'), event('b')]), store.save([event('b')])]);
		expect(await syncKeys()).toEqual(['event:b', 'player:1']);
	});

	it("skips ids whose events haven't synced yet", async () => {
		await fakeBrowser.storage.sync.set({ 'player:1': ['a', 'b'], 'event:b': event('b') });
		expect((await eventStore('1').load()).events).toEqual([event('b')]);
	});

	it('keeps events on this device when sync fails, until it works again', async () => {
		const store = eventStore('1');
		await store.load();
		const set = vi
			.spyOn(fakeBrowser.storage.sync, 'set')
			.mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'));
		expect(await store.save([event('a')])).toEqual({ localOnly: true });
		expect(await eventStore('1').load()).toEqual({ events: [event('a')], localOnly: true });

		set.mockRestore();
		expect(await store.save([event('a')])).toEqual({ localOnly: false });
		expect(await eventStore('1').load()).toEqual({ events: [event('a')], localOnly: false });
	});
});

describe('collapsed preference', () => {
	beforeEach(() => fakeBrowser.reset());

	it('starts expanded and syncs collapsing', async () => {
		expect(await loadCollapsed()).toBe(false);
		await saveCollapsed(true);
		expect(await loadCollapsed()).toBe(true);
		expect(await fakeBrowser.storage.sync.get('panelCollapsed')).toEqual({ panelCollapsed: true });
	});
});
