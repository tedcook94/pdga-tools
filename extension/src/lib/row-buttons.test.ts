import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadDocument } from './fixtures.test-helper';
import type { PageImportResult } from './page-import';
import { addRowButtons } from './row-buttons';

// The trimmed fixtures list the player as PDGA #1.
const buttonOf = (doc: Document) =>
	doc.querySelector('td.rating-projector span')?.shadowRoot?.querySelector('button');
const classesOf = (row: Element | null | undefined) =>
	[...(row?.children ?? [])].map((cell) => cell.classList[cell.classList.length - 1]);

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function setup(
	doc: Document,
	imported: string[] = [],
	result: PageImportResult = { ok: true, rounds: 3, updated: false, localOnly: false }
) {
	const onimport = vi.fn(async () => result);
	cleanup = addRowButtons(doc, new Set(imported), onimport);
	return onimport;
}

describe('addRowButtons', () => {
	it('adds a column right after PDGA# in the header and rows', () => {
		const doc = loadDocument('event-tournament.html');
		setup(doc);
		const header = classesOf(doc.querySelector('table.results thead tr'));
		const row = classesOf(doc.querySelector('table.results tbody tr'));
		expect(header.slice(3, 5)).toEqual(['pdga-number', 'rating-projector']);
		expect(row.slice(3, 5)).toEqual(['pdga-number', 'rating-projector']);
		expect(buttonOf(doc)?.getAttribute('aria-label')).toBe(
			"Import #1's rounds in Rating Projector"
		);
	});

	it('also adds the header cell to the sticky header copy', () => {
		const doc = loadDocument('event-tournament.html');
		const table = doc.querySelector('table.results')!;
		const sticky = doc.createElement('table');
		sticky.className = 'sticky-header';
		sticky.append(table.querySelector('thead')!.cloneNode(true));
		table.before(sticky);
		setup(doc);
		expect(sticky.querySelectorAll('th.rating-projector')).toHaveLength(1);
	});

	it('offers an update for players who already imported the event', () => {
		const doc = loadDocument('event-tournament.html');
		setup(doc, ['1']);
		expect(buttonOf(doc)?.title).toBe("Update #1's rounds in Rating Projector");
	});

	it('leaves the cell empty for rows with no rated rounds', () => {
		const doc = loadDocument('event-doubles.html');
		setup(doc);
		expect(doc.querySelector('tbody td.rating-projector')).not.toBeNull();
		expect(buttonOf(doc)).toBeUndefined();
	});

	it("imports that row's player and says where to see it", async () => {
		const doc = loadDocument('event-tournament.html');
		const onimport = setup(doc);
		buttonOf(doc)!.click();
		await vi.waitFor(() => expect(buttonOf(doc)!.className).toBe('done'));
		expect(onimport).toHaveBeenCalledWith('1');
		expect(buttonOf(doc)!.title).toBe(
			"Imported 3 rated rounds. See the projection on #1's ratings page, " +
				'or click to update again.'
		);
	});

	it('shows failures in the tooltip', async () => {
		const doc = loadDocument('event-tournament.html');
		setup(doc, [], { ok: false, error: 'Nope.' });
		buttonOf(doc)!.click();
		await vi.waitFor(() => expect(buttonOf(doc)!.className).toBe('failed'));
		expect(buttonOf(doc)!.title).toBe('Nope. Click to try again.');
	});

	it('removes the column on cleanup', () => {
		const doc = loadDocument('event-tournament.html');
		setup(doc);
		cleanup!();
		cleanup = undefined;
		expect(doc.querySelector('.rating-projector')).toBeNull();
	});
});
