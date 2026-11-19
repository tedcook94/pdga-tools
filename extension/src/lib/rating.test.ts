import { describe, expect, it } from 'vitest';
import { loadFixture } from './fixtures.test-helper';
import { pageCalcRounds } from './projection';
import { calculateRating, type RatedRound } from './rating';

// 445 has 21- and 24-hole rounds; 924 and 1014 drop a second round only
// because the spread leaves out the lowest; 939 drops a round the same way.
// 957 needs estimated league round dates: by the league's end date, its
// rounds would be doubled ahead of a tournament played before the league ended.
describe.each([
	{ file: 'rating-445.html', tolerance: 0 },
	{ file: 'rating-645.html', tolerance: 0 },
	{ file: 'rating-911.html', tolerance: 0 },
	{ file: 'rating-924.html', tolerance: 0 },
	{ file: 'rating-930.html', tolerance: 0 },
	{ file: 'rating-939.html', tolerance: 0 },
	{ file: 'rating-957.html', tolerance: 0 },
	{ file: 'rating-994.html', tolerance: 0 },
	{ file: 'rating-1014.html', tolerance: 0 }
])('calculateRating on $file', ({ file, tolerance }) => {
	const page = loadFixture(file);
	const result = calculateRating(pageCalcRounds(page));

	it('keeps every PDGA-evaluated round in the window', () => {
		// Compared as sets: league rounds share an end date, so their order is arbitrary.
		expect(new Set(result.evaluated.map((r) => r.page))).toEqual(
			new Set(page.rounds.filter((round) => round.evaluated))
		);
	});

	it(`lands within ${tolerance} of the published rating`, () => {
		expect(Math.abs(result.rating! - page.rating!)).toBeLessThanOrEqual(tolerance);
	});

	it('drops the same rounds as PDGA', () => {
		expect(result.dropped.map((r) => r.page)).toEqual(
			page.rounds.filter((round) => round.evaluated && !round.included)
		);
	});
});

const round = (date: string, rating: number): RatedRound => ({ date, rating });

describe('calculateRating rules', () => {
	it('returns nothing without rounds', () => {
		expect(calculateRating([])).toMatchObject({ rating: null, exact: null, evaluated: [] });
	});

	it('uses rounds on or after 12 months before the latest', () => {
		const rounds = [
			...Array.from({ length: 8 }, (_, i) => round(`2026-0${i + 1}-15`, 900)),
			round('2025-08-15', 900),
			round('2025-08-14', 700)
		];
		const result = calculateRating(rounds);
		expect(result.windowStart).toBe('2025-08-15');
		expect(result.evaluated).toHaveLength(9);
	});

	it('extends to 24 months with fewer than 8 rounds', () => {
		const rounds = [
			round('2026-06-01', 900),
			round('2026-01-01', 900),
			round('2024-06-01', 900),
			round('2024-05-31', 900)
		];
		const result = calculateRating(rounds);
		expect(result.windowStart).toBe('2024-06-01');
		expect(result.evaluated).toHaveLength(3);
	});

	it('drops rounds more than 100 below the average', () => {
		const rounds = [...Array.from({ length: 10 }, () => round('2026-06-01', 950)), round('2026-05-01', 800)];
		const result = calculateRating(rounds);
		expect(result.dropped.map((r) => r.rating)).toEqual([800]);
	});

	it('drops rounds 2.5 standard deviations below the average', () => {
		// Average about 947, spread 5: 920 is within 100 but outside 2.5 spreads.
		const ratings = [955, 945, 955, 945, 955, 945, 955, 945, 955, 945, 920];
		const result = calculateRating(ratings.map((r) => round('2026-06-01', r)));
		expect(result.dropped.map((r) => r.rating)).toEqual([920]);
	});

	it('leaves the lowest round out of the spread', () => {
		// Average 940. Counting 860 the spread is 40 and the cutoff 840, which
		// would keep it; without it the spread is 30 and the cutoff 865.
		const ratings = [980, 920, 980, 920, 980, 920, 980, 920, 860];
		const result = calculateRating(ratings.map((r) => round('2026-06-01', r)));
		expect(result.dropped.map((r) => r.rating)).toEqual([860]);
	});

	it("doesn't drop anything below 7 rounds", () => {
		const ratings = [900, 900, 900, 900, 900, 700];
		expect(calculateRating(ratings.map((r) => round('2026-06-01', r))).dropped).toEqual([]);
	});

	it('drops outliers in a single pass', () => {
		// After dropping 700, 840 would fall below a recomputed cutoff, but stays.
		const ratings = [900, 900, 900, 900, 900, 900, 900, 900, 900, 840, 700];
		const result = calculateRating(ratings.map((r) => round('2026-06-01', r)));
		expect(result.dropped.map((r) => r.rating)).toEqual([700]);
	});

	it('doubles the newest used round for every 4 evaluated rounds', () => {
		const rounds = Array.from({ length: 9 }, (_, i) => round(`2026-0${i + 1}-01`, 900 + i * 10));
		const result = calculateRating(rounds);
		expect(result.doubled.map((r) => r.date)).toEqual(['2026-09-01', '2026-08-01']);
		// 9 rounds 900–980 plus 980 and 970 again, each half a point up.
		expect(result.exact).toBeCloseTo((9 * 940 + 980 + 970) / 11 + 0.5);
	});

	it('doubles the best rounds of an event split by the cut', () => {
		// 12 rounds double 3: both rounds of the newest event, then the best
		// round of the next event rather than its newest.
		const event = (eventKey: string, date: string, ratings: number[]) =>
			ratings.map((rating): RatedRound => ({ date, rating, eventKey }));
		const rounds = [
			...event('a', '2026-09-01', [900, 910]),
			...event('b', '2026-08-01', [920, 990, 950]),
			...event('c', '2026-01-01', [900, 900, 900, 900, 900, 900, 900])
		];
		const doubled = calculateRating(rounds).doubled.map((r) => r.rating);
		expect(doubled).toEqual([900, 910, 990]);
	});

	it('weights rounds by holes', () => {
		const rounds = [
			{ date: '2026-06-01', rating: 900, holes: 27 },
			{ date: '2026-05-01', rating: 960, holes: 18 }
		];
		// 27 holes count 1.5 times; ratings get +0.5.
		expect(calculateRating(rounds).exact).toBeCloseTo((900.5 * 1.5 + 960.5) / 2.5);
	});

	it('adds half a point for truncated round ratings', () => {
		expect(calculateRating([round('2026-06-01', 900)])).toMatchObject({
			exact: 900.5,
			rating: 901
		});
	});

	it('skips dropped rounds when picking which to double', () => {
		const rounds = [
			round('2026-09-01', 700),
			...Array.from({ length: 8 }, (_, i) => round(`2026-0${i + 1}-01`, 900))
		];
		const result = calculateRating(rounds);
		expect(result.dropped.map((r) => r.date)).toEqual(['2026-09-01']);
		expect(result.doubled.map((r) => r.date)).toEqual(['2026-08-01', '2026-07-01']);
	});

	it("doesn't double anything below 9 evaluated rounds", () => {
		const rounds = Array.from({ length: 8 }, (_, i) => round(`2026-0${i + 1}-01`, 900 + i));
		expect(calculateRating(rounds).doubled).toEqual([]);
	});

	it('keeps the given order for same-day rounds', () => {
		const first = round('2026-06-01', 990);
		const rest = Array.from({ length: 8 }, () => round('2026-06-01', 900));
		expect(calculateRating([first, ...rest]).doubled[0]).toBe(first);
	});
});
