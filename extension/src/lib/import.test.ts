import { describe, expect, it } from 'vitest';
import type { EventPage, EventPageRound } from './event-page';
import type { AddedEvent } from './events';
import { importedEventId, importEvent } from './import';

const league: EventPage = {
	name: 'Fall League',
	kind: 'league',
	startDate: '2026-10-04',
	endDate: '2026-12-06'
};

const round = (number: number, rating = 900, date = '2026-10-04'): EventPageRound => ({
	number,
	date,
	rating,
	holes: 18
});

const handEntered: AddedEvent = {
	id: 'manual',
	kind: 'tournament',
	name: 'Hand entered',
	endDate: null,
	rounds: [{ id: 'm1', date: '2026-11-14', rating: 930 }]
};

describe('importEvent', () => {
	it('appends a new import with an id from the player and event', () => {
		const events = importEvent([handEntered], '7', 108060, league, [round(1), round(3)]);
		expect(importedEventId('7', 108060)).toBe('7-108060');
		expect(events[0]).toBe(handEntered);
		expect(events[1]).toMatchObject({
			id: '7-108060',
			kind: 'league',
			name: 'Fall League',
			endDate: '2026-12-06',
			pdgaEventId: 108060,
			rounds: [
				{ number: 1, date: '2026-10-04', rating: 900, holes: 18 },
				{ number: 3, date: '2026-10-04', rating: 900, holes: 18 }
			]
		});
	});

	it('leaves the end date unset for tournaments', () => {
		const tournament = { ...league, kind: 'tournament' as const };
		const [event] = importEvent([], '7', 1, tournament, [round(1, 900, '2026-12-06')]);
		expect(event).toMatchObject({ kind: 'tournament', endDate: null });
	});

	it('replaces an earlier import in place instead of adding a copy', () => {
		const first = importEvent([], '7', 1, league, [round(1, 900)]);
		const withOthers = [handEntered, ...first, { ...handEntered, id: 'later' }];
		const events = importEvent(withOthers, '7', 1, { ...league, name: 'Renamed' }, [
			round(1, 905),
			round(2, 950)
		]);
		expect(events.map((event) => event.id)).toEqual(['manual', '7-1', 'later']);
		expect(events[1]).toMatchObject({
			name: 'Renamed',
			rounds: [{ rating: 905 }, { rating: 950 }]
		});
	});

	it('keeps league round dates and row ids by round number', () => {
		const [first] = importEvent([], '7', 1, league, [round(1), round(2, 900, '2026-10-11')]);
		first!.rounds[1]!.date = '2026-10-18';
		const [refreshed] = importEvent([first!], '7', 1, league, [
			round(1),
			round(2, 910, '2026-10-11'),
			round(3, 920, '2026-10-18')
		]);
		expect(refreshed!.rounds.map(({ date, rating }) => [date, rating])).toEqual([
			['2026-10-04', 900],
			['2026-10-18', 910],
			['2026-10-18', 920]
		]);
		expect(refreshed!.rounds[1]!.id).toBe(first!.rounds[1]!.id);
	});

	it('drops kept dates past a moved end date', () => {
		const [first] = importEvent([], '7', 1, league, [round(1, 900, '2026-12-06')]);
		const shortened = { ...league, endDate: '2026-11-29' };
		const [refreshed] = importEvent([first!], '7', 1, shortened, [round(1, 900, '2026-11-29')]);
		expect(refreshed!.rounds[0]!.date).toBe('2026-11-29');
	});

	it('replaces tournament dates and removes rounds the page no longer has', () => {
		const tournament = { ...league, kind: 'tournament' as const };
		const [first] = importEvent([], '7', 1, tournament, [
			round(1, 900, '2026-11-01'),
			round(2, 900, '2026-11-01')
		]);
		first!.rounds.push({ id: 'extra', date: '2026-11-01', rating: 999 });
		const [refreshed] = importEvent([first!], '7', 1, tournament, [round(1, 900, '2026-11-08')]);
		expect(refreshed!.rounds).toMatchObject([{ number: 1, date: '2026-11-08' }]);
	});

	it("keeps each player's imports of one event apart", () => {
		const events = importEvent(importEvent([], '7', 1, league, []), '8', 1, league, []);
		expect(events.map((event) => event.id)).toEqual(['7-1', '8-1']);
	});
});
