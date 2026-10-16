import { describe, expect, it } from 'vitest';
import { isValidRating, percentile } from './percentile';

const ratings = { '800': 2, '900': 4, '1000': 2, '850': 2 };

describe('percentile', () => {
	it('counts half of tied players as below', () => {
		expect(percentile(ratings, 900)).toEqual({ percentile: 60, below: 4, equal: 4, total: 10 });
	});

	it('handles ratings between known values', () => {
		expect(percentile(ratings, 950)?.percentile).toBe(80);
	});

	it('returns 0 below everyone and 100 above everyone', () => {
		expect(percentile(ratings, 700)?.percentile).toBe(0);
		expect(percentile(ratings, 1100)?.percentile).toBe(100);
	});

	it('compares keys numerically, not as strings', () => {
		expect(percentile({ '999': 1, '1000': 1 }, 999)?.percentile).toBe(25);
	});

	it('returns null for invalid input or empty data', () => {
		expect(percentile(ratings, 900.5)).toBeNull();
		expect(percentile(ratings, -1)).toBeNull();
		expect(percentile(ratings, 1101)).toBeNull();
		expect(percentile(ratings, NaN)).toBeNull();
		expect(percentile({}, 900)).toBeNull();
	});
});

describe('isValidRating', () => {
	it('accepts whole numbers from 0 to 1100', () => {
		expect([0, 908, 1100].every(isValidRating)).toBe(true);
		expect([-1, 1101, 9.5, NaN, Infinity].some(isValidRating)).toBe(false);
	});
});
