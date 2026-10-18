export interface CurvePoint {
	rating: number;
	count: number;
}

export interface Curve {
	min: number;
	max: number;
	peak: number;
	peakRating: number;
	points: CurvePoint[];
}

// Without a minimum, a division where everyone shares one rating has a
// zero-width axis and every rating maps to the left edge.
export const MIN_SPAN = 200;

// Smaller groups get wider smoothing so a handful of players reads as a
// shape instead of separate blocks: about ±10 at 10,000 players, ±50 under 10.
export function smoothingRadius(total: number): number {
	return Math.min(50, Math.max(10, Math.round(50 - 10 * Math.log10(Math.max(1, total)))));
}

export function buildCurve(ratings: Record<string, number>, radius?: number): Curve | null {
	const entries = Object.entries(ratings).map(([k, v]) => [Number(k), v] as const);
	if (entries.length === 0) return null;

	let min = Math.min(...entries.map(([r]) => r));
	let max = Math.max(...entries.map(([r]) => r));
	if (max - min < MIN_SPAN) {
		min = Math.max(0, Math.floor((min + max - MIN_SPAN) / 2));
		max = min + MIN_SPAN;
	}
	const raw = new Array<number>(max - min + 1).fill(0);
	for (const [r, count] of entries) raw[r - min] += count;

	const total = entries.reduce((sum, [, count]) => sum + count, 0);
	const r = radius ?? smoothingRadius(total);
	const sigma = r / 2;
	const weights = Array.from({ length: r + 1 }, (_, d) =>
		sigma > 0 ? Math.exp(-(d * d) / (2 * sigma * sigma)) : 1
	);

	// Gaussian weights, normalized over the neighbors that exist, so the ends
	// aren't dragged toward zero by missing data.
	const points = raw.map((_, i) => {
		let sum = 0;
		let weight = 0;
		for (let j = Math.max(0, i - r); j <= Math.min(raw.length - 1, i + r); j++) {
			const w = weights[Math.abs(i - j)];
			sum += raw[j] * w;
			weight += w;
		}
		return { rating: min + i, count: sum / weight };
	});

	const peak = Math.max(...points.map((p) => p.count));
	const peakRating = points.find((p) => p.count === peak)!.rating;
	return { min, max, peak, peakRating, points };
}

export function clampRating(curve: Curve, rating: number): number {
	return Math.min(curve.max, Math.max(curve.min, Math.round(rating)));
}

export function linePath(curve: Curve, width: number, height: number): string {
	const span = curve.max - curve.min || 1;
	return curve.points
		.map((p, i) => {
			const x = ((p.rating - curve.min) / span) * width;
			const y = height - (p.count / (curve.peak || 1)) * height;
			return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join('');
}

export function areaPath(curve: Curve, width: number, height: number): string {
	return `${linePath(curve, width, height)}L${width},${height}L0,${height}Z`;
}
