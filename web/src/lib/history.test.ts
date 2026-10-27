import { describe, expect, it } from 'vitest';
import { historyPoints } from './history.ts';
import type { HistoryFile } from './percentile.ts';

const file = (year: number, ratings: Record<string, number>): HistoryFile => ({
	year,
	generated_at: '2026-10-25',
	total_players: Object.values(ratings).reduce((a, b) => a + b, 0),
	ratings
});

describe('historyPoints', () => {
	it('computes the percentile for the rating in each year', () => {
		const points = historyPoints(
			[file(2000, { '850': 1, '950': 1 }), file(2001, { '850': 3, '950': 1 })],
			900
		);
		expect(points).toEqual([
			{ year: 2000, percentile: 50, total: 2 },
			{ year: 2001, percentile: 75, total: 4 }
		]);
	});

	it('skips years with no players and invalid ratings', () => {
		expect(historyPoints([file(2000, {})], 900)).toEqual([]);
		expect(historyPoints([file(2000, { '900': 1 })], 2000)).toEqual([]);
	});
});
