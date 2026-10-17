import { loadLatestMonth } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ month: await loadLatestMonth() });
