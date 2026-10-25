import { loadLatestMonth } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const { key, month } = await loadLatestMonth();
	return { monthKey: key, month };
};
