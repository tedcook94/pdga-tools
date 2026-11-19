import { describe, expect, it } from 'vitest';
import type { AddedEvent } from './events';
import { loadFixture } from './fixtures.test-helper';
import { pageCalcRounds, pageRoundDate, project } from './projection';
import { calculateRating } from './rating';

const page = loadFixture('rating-911.html');

const shuffle: AddedEvent = {
	id: 'shuffle',
	kind: 'tournament',
	name: 'Shuffle',
	endDate: null,
	rounds: [
		{ id: 's1', date: '2026-11-13', rating: 868 },
		{ id: 's2', date: '2026-11-13', rating: 943 }
	]
};

// Rounds played from October on, but reported when the league ends in December.
const league: AddedEvent = {
	id: 'league',
	kind: 'league',
	name: 'Fall League',
	endDate: '2026-12-12',
	rounds: [
		{ id: 'l1', date: '2026-10-03', rating: 918 },
		{ id: 'l2', date: '2026-10-10', rating: 969 },
		{ id: 'l4', date: '2026-10-24', rating: 993 },
		{ id: 'l5', date: '2026-10-31', rating: 946 },
		{ id: 'l6', date: '2026-11-07', rating: 958 },
		{ id: 'l7', date: '2026-11-14', rating: 854 }
	]
};

const counted: AddedEvent = {
	id: 'counted',
	kind: 'tournament',
	name: 'Already in',
	endDate: null,
	rounds: [{ id: 'c1', date: '2026-11-08', rating: 999 }]
};

const baseRounds = pageCalcRounds(page);

describe('pageRoundDate', () => {
	const leagueRound = (round: string) => ({
		...page.rounds[0]!,
		tier: 'L',
		startDate: '2026-04-02',
		endDate: '2026-06-04',
		round
	});

	it('keeps the end date for tournaments', () => {
		expect(pageRoundDate({ ...page.rounds[0]!, startDate: '2026-04-24', endDate: '2026-04-26' })).toBe(
			'2026-04-26'
		);
	});

	it('places league round N at N − 1 weeks after the start', () => {
		expect(pageRoundDate(leagueRound('1'))).toBe('2026-04-02');
		expect(pageRoundDate(leagueRound('3'))).toBe('2026-04-16');
	});

	it('never goes past the league end date', () => {
		expect(pageRoundDate(leagueRound('20'))).toBe('2026-06-04');
	});

	it('keeps the end date for unnumbered league rounds', () => {
		expect(pageRoundDate(leagueRound('Finals'))).toBe('2026-06-04');
	});

	it('keeps PDGA-evaluated league rounds inside the current window', () => {
		// 911's fall 2025 league skipped weeks, so a weekly estimate lands before
		// the window PDGA evaluated it in.
		const rounds = pageCalcRounds(page);
		const { windowStart, evaluated } = calculateRating(rounds);
		expect(evaluated).toHaveLength(rounds.length);
		expect(rounds.every((r) => r.date >= windowStart!)).toBe(true);
	});

	it('moves league rounds out of the doubled set when they were played earlier', () => {
		// 957's spring league ended after a 25 May tournament, but most of its
		// rounds were played before it.
		const jay = loadFixture('rating-957.html');
		const { baseline } = project(jay, []);
		const doubledLeague = baseline.doubled.filter(
			(r) => r.source === 'page' && r.page.tier === 'L'
		);
		expect(doubledLeague.length).toBeLessThan(3);
		expect(baseline.rating).toBe(957);
	});
});

describe('project', () => {
	it('reads the current update from the page', () => {
		expect(project(page, []).current).toEqual({ date: '2026-11-10', cutoff: '2026-11-08' });
	});

	it('projects nothing without added rounds', () => {
		const projection = project(page, []);
		expect(projection.updates).toEqual([]);
		expect(projection.baseline.rating).toBe(911);
	});

	it('leaves out events dated on or before the current cutoff', () => {
		const projection = project(page, [counted]);
		expect(projection.counted).toEqual([counted]);
		expect(projection.updates).toEqual([]);
	});

	it('reports invalid events without projecting them', () => {
		const noEnd = { ...league, endDate: null };
		const projection = project(page, [noEnd]);
		expect(projection.invalid).toEqual([{ event: noEnd, problems: ['A league needs an end date.'] }]);
		expect(projection.updates).toEqual([]);
	});

	it('puts a tournament and a later league in separate updates', () => {
		const { updates } = project(page, [league, shuffle, counted]);
		expect(updates.map((u) => u.update.date)).toEqual(['2026-12-08', '2027-01-12']);
		expect(updates[0]!.added.map((r) => r.round.id)).toEqual(['s1', 's2']);
		expect(updates[1]!.added.map((r) => r.round.id)).toEqual(['l1', 'l2', 'l4', 'l5', 'l6', 'l7']);
	});

	it('lands league rounds at the end date but keeps their own dates', () => {
		const { updates } = project(page, [league]);
		expect(updates[0]!.update.date).toBe('2027-01-12');
		expect(updates[0]!.added.map((r) => r.date)).toEqual(league.rounds.map((r) => r.date));
	});

	it('lands a tournament after its last round', () => {
		const laborDay: AddedEvent = {
			...shuffle,
			rounds: [
				{ id: 'd1', date: '2026-12-05', rating: 900 },
				{ id: 'd2', date: '2026-12-07', rating: 900 }
			]
		};
		const { updates } = project(page, [laborDay]);
		// The 7 Dec round misses the 6 Dec cutoff, so the whole event waits for January.
		expect(updates.map((u) => u.update.date)).toEqual(['2027-01-12']);
		expect(updates[0]!.added.map((r) => r.date)).toEqual(['2026-12-05', '2026-12-07']);
	});

	it('builds each update on the rounds before it', () => {
		const { updates } = project(page, [league, shuffle]);
		const december = calculateRating([
			{ date: '2026-11-13', rating: 868 },
			{ date: '2026-11-13', rating: 943 },
			...baseRounds
		]);
		const baseline = calculateRating(baseRounds);
		const expected = Math.round(911 + december.exact! - baseline.exact!);
		expect(updates[0]!.rating).toBe(expected);
		expect(updates[0]!.change).toBe(expected - 911);
		expect(updates[1]!.change).toBe(updates[1]!.rating - updates[0]!.rating);
		expect(updates[1]!.result.evaluated).toEqual(
			expect.arrayContaining(updates[0]!.added)
		);
	});

	it('reports rounds that age out of the window', () => {
		const { updates } = project(page, [shuffle]);
		// A 13 Nov 2026 round moves the window start to 13 Nov 2025.
		expect(updates[0]!.result.windowStart).toBe('2025-11-13');
		const agedOut = updates[0]!.agedOut.map((r) => (r.source === 'page' ? r.page.endDate : r.date));
		// The league ending 30 Nov 2025 has an early round estimated before 13 Nov.
		expect(agedOut).toEqual(['2025-10-18', '2025-10-18', '2025-11-30']);
	});

	it("moves PDGA's rating by our change rather than using our absolute rating", () => {
		// Pretend PDGA published 4 above our 911, as with a league-heavy player.
		const { baseline, updates } = project({ ...page, rating: 915 }, [shuffle]);
		expect(baseline.rating).toBe(911);
		expect(updates[0]!.rating).toBe(
			Math.round(915 + updates[0]!.result.exact! - baseline.exact!)
		);
		expect(updates[0]!.rating - updates[0]!.result.rating!).toBe(4);
	});

	it('falls back to our rating when the page has none', () => {
		const { updates } = project({ ...page, rating: null }, [shuffle]);
		expect(updates[0]!.rating).toBe(updates[0]!.result.rating);
	});

	it('groups events that land in the same update', () => {
		const sameMonth: AddedEvent = {
			...shuffle,
			id: 'other',
			rounds: [{ id: 'o1', date: '2026-11-21', rating: 930 }]
		};
		const { updates } = project(page, [shuffle, sameMonth]);
		expect(updates).toHaveLength(1);
		expect(updates[0]!.added).toHaveLength(3);
	});

	it("doesn't mark anything counted without an update date", () => {
		const projection = project({ ...page, ratingDate: null }, [counted]);
		expect(projection.current).toBeNull();
		expect(projection.counted).toEqual([]);
		expect(projection.updates.map((u) => u.update.date)).toEqual(['2026-11-10']);
	});
});
