import { describe, expect, it } from 'vitest';
import { MIN_SPAN, areaPath, buildCurve, clampRating, linePath, smoothingRadius } from './curve.ts';

describe('buildCurve', () => {
	it('returns null for empty data', () => {
		expect(buildCurve({})).toBeNull();
	});

	it('fills gaps between min and max', () => {
		const curve = buildCurve({ '700': 2, '1000': 4 }, 0)!;
		expect(curve.min).toBe(700);
		expect(curve.max).toBe(1000);
		expect(curve.points[0].count).toBe(2);
		expect(curve.points[150].count).toBe(0);
		expect(curve.peak).toBe(4);
		expect(curve.peakRating).toBe(1000);
	});

	it('widens a narrow range to the minimum span, centered on the data', () => {
		const curve = buildCurve({ '805': 1 })!;
		expect(curve.max - curve.min).toBe(MIN_SPAN);
		expect(curve.min).toBe(705);
		expect(curve.peakRating).toBe(805);
	});

	it('does not extend the axis below zero', () => {
		const curve = buildCurve({ '7': 1 })!;
		expect(curve.min).toBe(0);
		expect(curve.max).toBe(MIN_SPAN);
	});

	it('turns a single rating into a rounded bump', () => {
		const counts = buildCurve({ '805': 1 })!.points.map((p) => p.count);
		const peak = counts.indexOf(Math.max(...counts));
		expect(counts[peak - 10]).toBeLessThan(counts[peak]);
		expect(counts[peak - 20]).toBeLessThan(counts[peak - 10]);
		expect(counts[peak + 10]).toBeCloseTo(counts[peak - 10]);
	});

	it('keeps edges from being dragged toward zero', () => {
		const curve = buildCurve({ '700': 5, '1000': 5 }, 10)!;
		expect(curve.points[0].count).toBeGreaterThan(curve.points[5].count);
	});
});

describe('smoothingRadius', () => {
	it('smooths small groups more', () => {
		expect(smoothingRadius(80000)).toBe(10);
		expect(smoothingRadius(1000)).toBe(20);
		expect(smoothingRadius(100)).toBe(30);
		expect(smoothingRadius(1)).toBe(50);
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
		const curve = buildCurve({ '0': 1, [MIN_SPAN]: 1 }, 0)!;
		const line = linePath(curve, 100, 50);
		expect(line.startsWith('M0.00,0.00')).toBe(true);
		expect(line.endsWith('L100.00,0.00')).toBe(true);
		expect(areaPath(curve, 100, 50).endsWith('L100,50L0,50Z')).toBe(true);
	});
});
