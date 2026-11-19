import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures.test-helper';
import { parseDate, parseDateRange, parseRatingsPage, type RatingsPage } from './ratings-page';

function parseHtml(html: string): RatingsPage {
	return parseRatingsPage(new DOMParser().parseFromString(html, 'text/html'));
}

describe('parseDate', () => {
	it('parses PDGA dates', () => {
		expect(parseDate('17-Oct-2026')).toBe('2026-10-17');
		expect(parseDate('7-Sep-2026')).toBe('2026-09-07');
	});

	it('rejects anything else', () => {
		expect(parseDate('')).toBeNull();
		expect(parseDate('Oct 17, 2026')).toBeNull();
		expect(parseDate('17-Foo-2026')).toBeNull();
	});
});

describe('parseDateRange', () => {
	it('treats a single date as a one-day range', () => {
		expect(parseDateRange('17-Oct-2026')).toEqual({ start: '2026-10-17', end: '2026-10-17' });
	});

	it('takes the start year from the end date', () => {
		expect(parseDateRange('2-Apr to 4-Jun-2026')).toEqual({
			start: '2026-04-02',
			end: '2026-06-04'
		});
	});

	it('handles ranges across the new year', () => {
		expect(parseDateRange('28-Dec to 4-Jan-2027')).toEqual({
			start: '2026-12-28',
			end: '2027-01-04'
		});
		expect(parseDateRange('28-Dec-2026 to 4-Jan-2027')).toEqual({
			start: '2026-12-28',
			end: '2027-01-04'
		});
	});

	it('rejects malformed ranges', () => {
		expect(parseDateRange('')).toBeNull();
		expect(parseDateRange('2-Apr to')).toBeNull();
		expect(parseDateRange('2-Apr to 4-Jun-2026 to 5-Jun-2026')).toBeNull();
	});
});

// Expected counts were taken from the fixtures independently of this parser.
describe.each([
	{ file: 'rating-911.html', rating: 911, rows: 92, evaluated: 34, dropped: [] },
	{
		file: 'rating-924.html',
		rating: 924,
		rows: 687,
		evaluated: 84,
		dropped: [
			{ endDate: '2026-08-08', rating: 835 },
			{ endDate: '2026-06-04', rating: 804 }
		]
	},
	{
		file: 'rating-930.html',
		rating: 930,
		rows: 68,
		evaluated: 36,
		dropped: [{ endDate: '2026-04-04', rating: 821 }]
	},
	{
		file: 'rating-957.html',
		rating: 957,
		rows: 209,
		evaluated: 41,
		dropped: [{ endDate: '2025-11-22', rating: 888 }]
	},
	{
		file: 'rating-994.html',
		rating: 994,
		rows: 323,
		evaluated: 111,
		dropped: [
			{ endDate: '2026-07-25', rating: 913 },
			{ endDate: '2026-04-26', rating: 868 }
		]
	}
])('parseRatingsPage($file)', ({ file, rating, rows, evaluated, dropped }) => {
	const page = loadFixture(file);

	it('reads the current rating and update date', () => {
		expect(page.rating).toBe(rating);
		expect(page.ratingDate).toBe('2026-11-10');
	});

	it('reads every round', () => {
		expect(page.rounds).toHaveLength(rows);
		expect(page.rounds.filter((r) => r.evaluated)).toHaveLength(evaluated);
	});

	it('finds the dropped rounds', () => {
		const found = page.rounds
			.filter((r) => r.evaluated && !r.included)
			.map((r) => ({ endDate: r.endDate, rating: r.rating }));
		expect(found).toEqual(dropped);
	});

	it('never marks a round included without evaluating it', () => {
		expect(page.rounds.filter((r) => r.included && !r.evaluated)).toEqual([]);
	});
});

describe('parseRatingsPage row details', () => {
	it('reads a tournament round', () => {
		expect(loadFixture('rating-911.html').rounds[0]).toEqual({
			eventId: 1,
			eventName: 'Event 1',
			tier: 'C/B',
			startDate: '2026-10-17',
			endDate: '2026-10-17',
			division: 'MA2',
			round: '1',
			score: 63,
			rating: 930,
			holes: 18,
			evaluated: true,
			included: true
		});
	});

	it("reads each round's hole count from its layout tooltip", () => {
		const event6 = loadFixture('rating-911.html').rounds.filter((r) => r.eventId === 6);
		expect(event6.map((r) => r.holes)).toEqual([21, 21]);
	});

	it('assumes 18 holes when a round has no layout tooltip', () => {
		const doc = new DOMParser().parseFromString(
			`<table id="player-results-details"><tbody><tr class="evaluated">
				<td class="tournament"><a href="/tour/event/1">Event 1</a></td>
				<td class="date">17-Oct-2026</td><td class="round">1</td>
				<td class="round-rating">930</td><td class="evaluated">Yes</td>
			</tr></tbody></table>`,
			'text/html'
		);
		expect(parseRatingsPage(doc).rounds[0]!.holes).toBe(18);
	});

	it('dates a league by its range', () => {
		const league = loadFixture('rating-911.html').rounds.find(
			(r) => r.tier === 'L' && r.evaluated
		);
		expect(league).toMatchObject({
			startDate: '2026-04-02',
			endDate: '2026-06-04',
			evaluated: true
		});
	});

	it('dates a multi-day tournament by its range', () => {
		expect(loadFixture('rating-994.html').rounds[0]).toMatchObject({
			tier: 'A',
			startDate: '2026-11-06',
			endDate: '2026-11-08'
		});
	});

	it('keeps non-numeric round labels', () => {
		expect(loadFixture('rating-994.html').rounds.filter((r) => r.round === 'Finals')).toHaveLength(
			2
		);
	});
});

describe('parseRatingsPage edge cases', () => {
	const row = (cls: string, rating = '900') =>
		`<tr class="${cls}"><td class="tournament"><a href="/tour/event/1">Event</a></td><td class="tier">C</td><td class="date">1-Oct-2026</td><td class="division">MA3</td><td class="round">1</td><td class="score">54</td><td class="round-rating">${rating}</td><td class="evaluated">Yes</td><td class="included">Yes</td></tr>`;
	const table = (rows: string) =>
		`<table id="player-results-details"><tbody>${rows}</tbody></table>`;

	it('ignores rows inserted by other extensions', () => {
		const page = parseHtml(table(row('evaluated included odd') + row('') + row('added-round')));
		expect(page.rounds).toHaveLength(1);
	});

	it('skips rows without a rating', () => {
		expect(parseHtml(table(row('evaluated included', ''))).rounds).toEqual([]);
	});

	it('returns nothing for a page without ratings', () => {
		expect(parseHtml('<p>Not a player page</p>')).toEqual({
			rating: null,
			ratingDate: null,
			rounds: []
		});
	});

	it('reads the rating line without a change badge', () => {
		const page = parseHtml(
			'<ul><li class="current-rating"> <strong>Current Rating:</strong> 924 <small class="rating-date">(as of 10-Nov-2026)</small> </li></ul>'
		);
		expect(page.rating).toBe(924);
		expect(page.ratingDate).toBe('2026-11-10');
	});
});
