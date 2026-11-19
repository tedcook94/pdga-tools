import { describe, expect, it } from 'vitest';
import { addDays, monthsBefore, ratingsUpdate, updateFor, updateOn } from './schedule';

// Second Tuesdays taken from Python's calendar module.
const UPDATES = {
	2026: [
		'2026-01-13',
		'2026-02-10',
		'2026-03-10',
		'2026-04-14',
		'2026-05-12',
		'2026-06-09',
		'2026-07-14',
		'2026-08-11',
		'2026-09-08',
		'2026-10-13',
		'2026-11-10',
		'2026-12-08'
	],
	2027: [
		'2027-01-12',
		'2027-02-09',
		'2027-03-09',
		'2027-04-13',
		'2027-05-11',
		'2027-06-08',
		'2027-07-13',
		'2027-08-10',
		'2027-09-14',
		'2027-10-12',
		'2027-11-09',
		'2027-12-14'
	]
};

describe('ratingsUpdate', () => {
	it.each(Object.entries(UPDATES))('falls on the second Tuesday of each month in %s', (year, dates) => {
		const actual = dates.map((_, i) => ratingsUpdate(Number(year), i + 1).date);
		expect(actual).toEqual(dates);
	});

	it('cuts off on the Sunday two days before', () => {
		expect(ratingsUpdate(2026, 11)).toEqual({ date: '2026-11-10', cutoff: '2026-11-08' });
		expect(ratingsUpdate(2026, 9)).toEqual({ date: '2026-09-08', cutoff: '2026-09-06' });
	});
});

describe('updateFor', () => {
	it('includes a round played on the cutoff', () => {
		expect(updateFor('2026-11-08').date).toBe('2026-11-10');
	});

	it('moves a round after the cutoff to the next month', () => {
		expect(updateFor('2026-11-09').date).toBe('2026-12-08');
		expect(updateFor('2026-11-30').date).toBe('2026-12-08');
	});

	it('rolls over to January', () => {
		expect(updateFor('2026-12-31').date).toBe('2027-01-12');
	});

	it('puts Labor Day 2026 after the September cutoff', () => {
		expect(updateFor('2026-09-06').date).toBe('2026-09-08');
		expect(updateFor('2026-09-07').date).toBe('2026-10-13');
	});
});

describe('updateOn', () => {
	it('recognizes an update date', () => {
		expect(updateOn('2026-11-10')).toEqual({ date: '2026-11-10', cutoff: '2026-11-08' });
	});

	it('rejects other days', () => {
		expect(updateOn('2026-11-11')).toBeNull();
	});
});

describe('date helpers', () => {
	it('adds days across months and years', () => {
		expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
		expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
	});

	it('goes back whole months', () => {
		expect(monthsBefore('2026-10-17', 12)).toBe('2025-10-17');
		expect(monthsBefore('2026-11-07', 24)).toBe('2024-11-07');
	});

	it('clamps to the end of shorter months', () => {
		expect(monthsBefore('2028-02-29', 12)).toBe('2027-02-28');
		expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28');
	});
});
