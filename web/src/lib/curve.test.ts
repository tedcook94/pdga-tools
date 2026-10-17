import { describe, expect, it } from 'vitest';
import { areaPath, buildCurve, clampRating, linePath } from './curve.ts';

describe('buildCurve', () => {
	it('returns null for empty data', () => {
		expect(buildCurve({})).toBeNull();
	});

	it('fills gaps between min and max', () => {
		const curve = buildCurve({ '10': 2, '13': 4 }, 0)!;
		expect(curve.min).toBe(10);
		expect(curve.max).toBe(13);
		expect(curve.points.map((p) => p.count)).toEqual([2, 0, 0, 4]);
		expect(curve.peak).toBe(4);
		expect(curve.peakRating).toBe(13);
	});

	it('smooths with a window that shrinks at the edges', () => {
		const curve = buildCurve({ '0': 3, '1': 0, '2': 0 }, 1)!;
		expect(curve.points.map((p) => p.count)).toEqual([1.5, 1, 0]);
	});
});

describe('clampRating', () => {
	const curve = buildCurve({ '700': 1, '1000': 1 })!;

	it('rounds and clamps to the data range', () => {
		expect(clampRating(curve, 850.6)).toBe(851);
		expect(clampRating(curve, 400)).toBe(700);
		expect(clampRating(curve, 1100)).toBe(1000);
	});
});

describe('paths', () => {
	it('spans the full width and closes the area at the baseline', () => {
		const curve = buildCurve({ '0': 1, '1': 1 }, 0)!;
		expect(linePath(curve, 100, 50)).toBe('M0.00,0.00L100.00,0.00');
		expect(areaPath(curve, 100, 50)).toBe('M0.00,0.00L100.00,0.00L100,50L0,50Z');
	});
});
