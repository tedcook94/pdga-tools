import { error } from '@sveltejs/kit';
import type { HistoryFile, LocationFile, MonthFile } from '#lib/percentile.ts';

// Bundled at build time from the fetcher's output in the repo root. Paths are
// relative to this file, so routes can move without breaking them.
const current = import.meta.glob<MonthFile>('../../../data/current.json', { import: 'default' });
// Each location and year becomes its own chunk, downloaded only when needed.
const locations = import.meta.glob<LocationFile>('../../../data/current/*.json', {
	import: 'default'
});
const years = import.meta.glob<HistoryFile>('../../../data/history/*.json', { import: 'default' });

export async function loadCurrent(): Promise<MonthFile> {
	const load = current['../../../data/current.json'];
	if (!load) error(500, 'data/current.json not found; run the fetcher first');
	return load();
}

export async function loadLocation(location: string): Promise<LocationFile> {
	const load = locations[`../../../data/current/${location}.json`];
	if (!load) throw new Error(`data/current/${location}.json not found`);
	return load();
}

/** All yearly history files, oldest first. */
export async function loadHistory(): Promise<HistoryFile[]> {
	const files = await Promise.all(Object.values(years).map((load) => load()));
	return files.sort((a, b) => a.year - b.year);
}
