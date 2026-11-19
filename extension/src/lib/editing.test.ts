import { describe, expect, it } from 'vitest';
import { formatChange, formatDate, newEvent, newRound, roundLabel } from './editing';
import type { AddedCalcRound, PageCalcRound } from './projection';

describe('newRound', () => {
	it("copies the previous round's date and numbers it next", () => {
		const round = newRound([{ id: 'a', date: '2026-11-13', rating: 900, number: 4 }]);
		expect(round).toMatchObject({ number: 5, date: '2026-11-13', rating: null });
	});

	it('numbers after the position when the previous round has no number', () => {
		const rounds = [
			{ id: 'a', date: '2026-11-13', rating: 900 },
			{ id: 'b', date: '2026-11-13', rating: 900 }
		];
		expect(newRound(rounds).number).toBe(3);
	});

	it('starts at round 1, undated', () => {
		expect(newRound([])).toMatchObject({ number: 1, date: null });
	});
});

describe('newEvent', () => {
	it('starts with one blank round', () => {
		const event = newEvent('league');
		expect(event).toMatchObject({ kind: 'league', name: '', endDate: null });
		expect(event.rounds).toHaveLength(1);
	});

	it('gives every event a distinct id', () => {
		expect(newEvent('tournament').id).not.toBe(newEvent('tournament').id);
	});
});

describe('formatting', () => {
	it('formats dates', () => {
		expect(formatDate('2026-12-08')).toBe('8 Dec 2026');
	});

	it('signs changes', () => {
		expect([formatChange(8), formatChange(-1), formatChange(0)]).toEqual(['+8', '−1', '±0']);
	});
});

describe('roundLabel', () => {
	it('names page rounds by event and round', () => {
		const round = { source: 'page', page: { eventName: 'Event 3', round: '2' } } as PageCalcRound;
		expect(roundLabel(round)).toBe('Event 3 R2');
	});

	it('uses the round number for added rounds', () => {
		const event = newEvent('tournament');
		event.rounds.push({ ...newRound(event.rounds), number: 3 });
		const round = { source: 'added', event, round: event.rounds[1] } as AddedCalcRound;
		expect(roundLabel(round)).toBe('Untitled R3');
	});
});
