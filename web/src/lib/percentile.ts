export const MIN_RATING = 0;
export const MAX_RATING = 1100;

export interface MonthFile {
	generated_at: string;
	ratings_update: string;
	active_window_months: number;
	total_players: number;
	ratings: Record<string, number>;
}

export interface Result {
	percentile: number;
	below: number;
	equal: number;
	above: number;
	total: number;
}

export function isValidRating(rating: number): boolean {
	return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
}

export function percentile(ratings: Record<string, number>, rating: number): Result | null {
	if (!isValidRating(rating)) return null;

	let below = 0;
	let equal = 0;
	let total = 0;
	for (const [key, count] of Object.entries(ratings)) {
		const value = Number(key);
		total += count;
		if (value < rating) below += count;
		else if (value === rating) equal = count;
	}
	if (total === 0) return null;

	return {
		percentile: ((below + equal / 2) / total) * 100,
		below,
		equal,
		above: total - below - equal,
		total
	};
}

export function ordinal(n: number): string {
	const whole = Math.floor(n);
	const lastTwo = whole % 100;
	if (lastTwo >= 11 && lastTwo <= 13) return 'th';
	return ['th', 'st', 'nd', 'rd'][whole % 10] ?? 'th';
}
