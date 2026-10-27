import { percentile, type HistoryFile } from './percentile.ts';

export interface HistoryPoint {
	year: number;
	percentile: number;
	total: number;
}

export function historyPoints(files: HistoryFile[], rating: number): HistoryPoint[] {
	return files.flatMap((file) => {
		const result = percentile(file.ratings, rating);
		return result ? [{ year: file.year, percentile: result.percentile, total: result.total }] : [];
	});
}
