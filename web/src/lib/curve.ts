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

export function buildCurve(ratings: Record<string, number>, radius = 10): Curve | null {
	const entries = Object.entries(ratings).map(([k, v]) => [Number(k), v] as const);
	if (entries.length === 0) return null;

	const min = Math.min(...entries.map(([r]) => r));
	const max = Math.max(...entries.map(([r]) => r));
	const raw = new Array<number>(max - min + 1).fill(0);
	for (const [r, count] of entries) raw[r - min] += count;

	// Moving average over a window that shrinks at the edges, so the ends
	// aren't dragged toward zero by missing neighbors.
	const points = raw.map((_, i) => {
		const from = Math.max(0, i - radius);
		const to = Math.min(raw.length - 1, i + radius);
		let sum = 0;
		for (let j = from; j <= to; j++) sum += raw[j];
		return { rating: min + i, count: sum / (to - from + 1) };
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
