import { error } from '@sveltejs/kit';
import type { MonthFile } from '#lib/percentile.ts';

// Bundled at build time from the fetcher's output in the repo root. Paths are
// relative to this file, so routes can move without breaking them.
const index = import.meta.glob<{ latest: string }>('../../../data/index.json', { import: 'default' });
const months = import.meta.glob<MonthFile>('../../../data/????-??.json', { import: 'default' });

export async function loadLatestMonth(): Promise<MonthFile> {
	const loadIndex = index['../../../data/index.json'];
	if (!loadIndex) error(500, 'data/index.json not found; run the fetcher first');
	const { latest } = await loadIndex();

	const loadMonth = months[`../../../data/${latest}.json`];
	if (!loadMonth) error(500, `data/${latest}.json not found`);
	return loadMonth();
}
