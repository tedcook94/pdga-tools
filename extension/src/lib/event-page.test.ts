import { describe, expect, it } from 'vitest';
import { parseEventId, parseEventPage, parseEventRounds } from './event-page';
import { loadDocument } from './fixtures.test-helper';

function parse(doc: ParentNode, player = '1') {
	const event = parseEventPage(doc);
	if (!event) throw new Error('not an event page');
	return { event, rounds: parseEventRounds(doc, event, player) };
}

function html(source: string): Document {
	return new DOMParser().parseFromString(source, 'text/html');
}

interface PageOptions {
	type?: string;
	date?: string;
	head?: string;
	rows?: string;
	layouts?: string;
}

function eventPage({
	type = 'C-Tier',
	date = '17-Oct-2026',
	head = '',
	rows = '',
	layouts = ''
}: PageOptions): Document {
	return html(`
		<h1 id="page-title">Tom &amp; Jerry Open</h1>
		<div class="pane-tournament-event-info">
			<h4>${type}</h4>
			<ul><li class="tournament-date"><strong>Date</strong>: ${date}</li></ul>
		</div>
		${layouts}
		<table class="results"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
	`);
}

const header = (label: string, layout = '') =>
	`<th class="round tooltip" data-tooltip-content="#${layout}">${label}</th><th class="round-rating"></th>`;

const row = (player: string, ...ratings: string[]) =>
	`<tr><td class="pdga-number">${player}</td>${ratings
		.map((rating) => `<td class="round">54</td><td class="round-rating">${rating}</td>`)
		.join('')}</tr>`;

describe('parseEventId', () => {
	it.each([
		'108060',
		'  108060 ',
		'https://www.pdga.com/tour/event/108060',
		'http://pdga.com/tour/event/108060/',
		'www.pdga.com/tour/event/108060#MA1',
		'pdga.com/tour/event/108060?x=1',
		'https://www.pdga.com/live/event/108060',
		'https://www.pdga.com/live/event/108060/MA1/scores?round=7'
	])('reads the ID from %j', (text) => {
		expect(parseEventId(text)).toBe(108060);
	});

	it.each([
		'',
		'0',
		'-5',
		'1.5',
		'108060abc',
		'12345678901',
		'https://www.pdga.com/player/108060',
		'https://www.pdga.com/tour/event/108060abc',
		'https://www.pdga.com/tour/event/',
		'https://www.pdga.com.example.com/tour/event/108060',
		'https://notpdga.com/tour/event/108060',
		'https://example.com/?u=https://www.pdga.com/tour/event/108060',
		'javascript:108060'
	])('rejects %j', (text) => {
		expect(parseEventId(text)).toBeNull();
	});
});

// Expected values were read from the saved pages independently of this parser.
describe('fixtures', () => {
	it('reads a multi-day tournament', () => {
		const { event, rounds } = parse(loadDocument('event-tournament.html'));
		expect(event).toEqual({
			name: 'Event 1',
			kind: 'tournament',
			startDate: '2025-05-03',
			endDate: '2025-05-04'
		});
		expect(rounds).toEqual([
			{ number: 1, date: '2025-05-04', rating: 865, holes: 18 },
			{ number: 2, date: '2025-05-04', rating: 883, holes: 18 },
			{ number: 3, date: '2025-05-04', rating: 847, holes: 18 }
		]);
	});

	it('reads a completed league with one round played', () => {
		const { event, rounds } = parse(loadDocument('event-league-complete.html'));
		expect(event).toMatchObject({
			kind: 'league',
			startDate: '2025-10-05',
			endDate: '2025-11-30'
		});
		expect(rounds).toEqual([{ number: 2, date: '2025-10-12', rating: 950, holes: 18 }]);
	});

	it('reads an active league, skipping missed and unplayed weeks', () => {
		const { event, rounds } = parse(loadDocument('event-league-active.html'));
		expect(event).toMatchObject({ kind: 'league', endDate: '2026-12-06' });
		expect(rounds?.map(({ number, date, rating }) => [number, date, rating])).toEqual([
			[1, '2026-10-04', 918],
			[2, '2026-10-11', 969],
			[4, '2026-10-25', 993],
			[5, '2026-11-01', 946],
			[6, '2026-11-08', 958],
			[7, '2026-11-15', 854]
		]);
	});

	it('reads hole counts other than 18', () => {
		const { rounds } = parse(loadDocument('event-holes.html'));
		expect(rounds).toEqual([
			{ number: 1, date: '2026-01-24', rating: 869, holes: 21 },
			{ number: 2, date: '2026-01-24', rating: 836, holes: 21 }
		]);
	});

	it('finds a doubles team member but no rated rounds', () => {
		const { event, rounds } = parse(loadDocument('event-doubles.html'));
		expect(event).toMatchObject({ kind: 'tournament', endDate: '2026-07-18' });
		expect(rounds).toEqual([]);
	});
});

describe('parseEventPage', () => {
	it('decodes the name and reads a one-day event', () => {
		expect(parseEventPage(eventPage({}))).toEqual({
			name: 'Tom & Jerry Open',
			kind: 'tournament',
			startDate: '2026-10-17',
			endDate: '2026-10-17'
		});
	});

	it('rejects pages without event info', () => {
		expect(parseEventPage(html('<h1 id="page-title">Access denied</h1>'))).toBeNull();
		expect(parseEventPage(eventPage({ date: 'TBD' }))).toBeNull();
	});
});

describe('parseEventRounds', () => {
	it("returns null when the player isn't in the results", () => {
		const doc = eventPage({ head: header('Rd1'), rows: row('12', '900') + row('', '800') });
		expect(parse(doc, '1').rounds).toBeNull();
	});

	it('matches the whole PDGA number', () => {
		const doc = eventPage({ head: header('Rd1'), rows: row('123', '900') + row('12', '850') });
		expect(parse(doc, '12').rounds).toMatchObject([{ rating: 850 }]);
	});

	it('skips rounds without a rating', () => {
		const doc = eventPage({
			head: header('Rd1') + header('Rd2') + header('Rd3'),
			rows: row('1', '900', '', '910')
		});
		expect(parse(doc).rounds).toMatchObject([{ number: 1 }, { number: 3 }]);
	});

	it("finds a doubles partner, whose row shares the team's cells", () => {
		const doc = eventPage({
			head: header('Rd1'),
			rows:
				'<tr><td class="odd pdga-number">1</td><td class="odd round" rowspan="2">48</td>' +
				'<td class="odd round-rating" rowspan="2"></td></tr>' +
				'<tr><td class="odd pdga-number">2</td></tr>'
		});
		expect(parse(doc, '1').rounds).toEqual([]);
		expect(parse(doc, '2').rounds).toEqual([]);
	});

	it('returns an empty list when nothing is rated or the row has no rounds', () => {
		expect(parse(eventPage({ head: header('Rd1'), rows: row('1', '') })).rounds).toEqual([]);
		expect(parse(eventPage({ head: header('Rd1'), rows: row('1') })).rounds).toEqual([]);
	});

	it('numbers semis and finals after the labeled rounds', () => {
		const doc = eventPage({
			head: header('Rd1') + header('Rd2') + header('Semis') + header('Finals'),
			rows: row('1', '900', '910', '920', '930')
		});
		expect(parse(doc).rounds?.map(({ number }) => number)).toEqual([1, 2, 3, 4]);
	});

	it('dates league finals by the end date and caps estimates there', () => {
		const doc = eventPage({
			type: 'Amateur League',
			date: '1-Oct to 10-Oct-2026',
			head: header('Rd1') + header('Rd3') + header('Finals'),
			rows: row('1', '900', '910', '920')
		});
		expect(parse(doc).rounds?.map(({ date }) => date)).toEqual([
			'2026-10-01',
			'2026-10-10',
			'2026-10-10'
		]);
	});

	it("reads each round's holes and assumes 18 without a layout", () => {
		const doc = eventPage({
			head: header('Rd1', 'layout-details-1-MA1-round-1') + header('Rd2'),
			rows: row('1', '900', '910'),
			layouts: '<div id="layout-details-1-MA1-round-1">Course - Long; 21 holes; Par 63</div>'
		});
		expect(parse(doc).rounds?.map(({ holes }) => holes)).toEqual([21, 18]);
	});
});
