import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddedEvent } from '@/lib/events';
import { loadFixture } from '@/lib/fixtures.test-helper';
import Panel from './Panel.svelte';

// Rated 911 as of 10 Nov 2026, so rounds through 8 Nov are already counted.
const page = loadFixture('rating-911.html');

const shuffle = (): AddedEvent => ({
	id: 'shuffle',
	kind: 'tournament',
	name: 'Shuffle',
	endDate: null,
	rounds: [
		{ id: 's1', date: '2026-11-13', rating: 868 },
		{ id: 's2', date: '2026-11-13', rating: 943 }
	]
});

const counted = (): AddedEvent => ({
	id: 'old',
	kind: 'tournament',
	name: 'Old',
	endDate: null,
	rounds: [{ id: 'o1', date: '2026-11-01', rating: 930 }]
});

let panel: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (panel) unmount(panel);
	panel = undefined;
	document.body.innerHTML = '';
});

function render(initialEvents: AddedEvent[], initialCollapsed = false) {
	const onchange = vi.fn<(events: AddedEvent[]) => void>();
	const oncollapse = vi.fn<(collapsed: boolean) => void>();
	panel = mount(Panel, {
		target: document.body,
		props: { page, initialEvents, initialCollapsed, onchange, oncollapse }
	});
	flushSync();
	return { onchange, oncollapse, lastSaved: () => onchange.mock.lastCall?.[0] };
}

function field(label: string) {
	const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
	if (!input) throw new Error(`No field "${label}"`);
	return input;
}

// Real typing fires input on each key and change when the field is left.
function type(label: string, value: string, { commit = true } = {}) {
	const input = field(label);
	input.value = value;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	if (commit) input.dispatchEvent(new Event('change', { bubbles: true }));
	flushSync();
}

const text = () => document.body.textContent?.replace(/\s+/g, ' ') ?? '';

function click(label: string) {
	const button = [...document.querySelectorAll('button')].find(
		(b) =>
			b.textContent?.replace('▾', '').trim() === label || b.getAttribute('aria-label') === label
	);
	if (!button) throw new Error(`No button "${label}"`);
	button.click();
	flushSync();
}

describe('Panel', () => {
	it('explains what to do with no events', () => {
		const { onchange } = render([]);
		expect(text()).toContain('Add a tournament or league');
		expect(onchange).not.toHaveBeenCalled();
	});

	it('projects the update an added tournament lands in', () => {
		render([shuffle()]);
		const update = document.querySelector('.update')!.textContent!.replace(/\s+/g, ' ');
		expect(update).toContain('8 Dec 2026');
		expect(update).toContain('909 −2');
		expect(update).toContain('Added 2');
		expect(update).toContain('Shuffle R1 868');
	});

	it('deletes a round in one click and saves', () => {
		const { lastSaved } = render([shuffle()]);
		click('Delete round 1');
		expect(lastSaved()![0]!.rounds.map((r) => r.rating)).toEqual([943]);
	});

	it('numbers and dates a new round after the one before it', () => {
		const { lastSaved } = render([shuffle()]);
		click('+ Round');
		expect(lastSaved()![0]!.rounds[2]).toMatchObject({
			number: 3,
			date: '2026-11-13',
			rating: null
		});
		expect(text()).toContain('Every round needs a whole-number rating');
	});

	it('saves inline edits when a field is left', () => {
		const { lastSaved } = render([shuffle()]);
		type('Round 2 rating', '950');
		type('Round 2 holes', '27');
		expect(lastSaved()![0]!.rounds[1]).toMatchObject({ rating: 950, holes: 27 });
	});

	it('waits for a finished value before reprojecting', () => {
		const { onchange } = render([shuffle()]);
		const before = document.querySelector('.update')!.textContent;
		type('Round 2 rating', '9', { commit: false });
		expect(document.querySelector('.update')!.textContent).toBe(before);
		expect(onchange).not.toHaveBeenCalled();
	});

	it('renumbers rounds for missed weeks', () => {
		const { lastSaved } = render([shuffle()]);
		type('Round 2 number', '3');
		expect(lastSaved()![0]!.rounds.map((r) => r.number)).toEqual([undefined, 3]);
		expect(text()).toContain('Shuffle R3 943');
	});

	it('flags repeated round numbers', () => {
		render([shuffle()]);
		type('Round 2 number', '1');
		expect(text()).toContain('Round numbers must be different.');
	});

	it('adds a league that needs an end date', () => {
		const { lastSaved } = render([]);
		click('+ League');
		expect(lastSaved()).toEqual([expect.objectContaining({ kind: 'league', endDate: null })]);
		expect(text()).toContain('A league needs an end date.');
	});

	it('collapses to the next projection and remembers it', () => {
		const { oncollapse } = render([shuffle()]);
		click('Rating projection');
		expect(oncollapse).toHaveBeenLastCalledWith(true);
		expect(document.querySelector('.update')).toBeNull();
		expect(text()).toContain('8 Dec 2026 · 909 −2');
	});

	it('starts collapsed when saved that way', () => {
		const { oncollapse } = render([shuffle()], true);
		expect(document.querySelector('.update')).toBeNull();
		click('Rating projection');
		expect(oncollapse).toHaveBeenLastCalledWith(false);
		expect(document.querySelector('.update')).not.toBeNull();
	});

	it('says when sync failed and rounds stay on this device', async () => {
		const onchange = vi.fn(async () => ({ localOnly: true }));
		panel = mount(Panel, { target: document.body, props: { page, initialEvents: [], onchange } });
		flushSync();
		expect(text()).not.toContain('Saved on this device only');
		click('+ League');
		await vi.waitFor(() => expect(text()).toContain('Saved on this device only'));
	});

	it('greys out counted events and clears them', () => {
		const { lastSaved } = render([counted(), shuffle()]);
		expect(document.querySelector('.counted')?.textContent).toContain('Already counted');
		click('Clear counted (1)');
		expect(lastSaved()!.map((e) => e.id)).toEqual(['shuffle']);
		expect(document.querySelector('.counted')).toBeNull();
	});

	it('shows changes from other tabs without saving them back', () => {
		let push: ((result: { events: AddedEvent[]; localOnly: boolean }) => void) | undefined;
		const stop = vi.fn();
		const onchange = vi.fn<(events: AddedEvent[]) => void>();
		panel = mount(Panel, {
			target: document.body,
			props: {
				page,
				initialEvents: [],
				onchange,
				watch: (callback) => {
					push = callback;
					return stop;
				}
			}
		});
		flushSync();
		expect(onchange).not.toHaveBeenCalled();

		push!({ events: [shuffle()], localOnly: false });
		flushSync();
		expect(field('Tournament name').value).toBe('Shuffle');
		expect(onchange).not.toHaveBeenCalled();

		type('Tournament name', 'Shuffle 2026');
		expect(onchange.mock.lastCall?.[0][0]).toMatchObject({ name: 'Shuffle 2026' });

		unmount(panel);
		panel = undefined;
		expect(stop).toHaveBeenCalled();
	});
});
