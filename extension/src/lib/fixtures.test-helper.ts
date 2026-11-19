import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRatingsPage, type RatingsPage } from './ratings-page';

/** Parses a trimmed ratings detail page from `extension/fixtures/`. */
export function loadFixture(name: string): RatingsPage {
	// Vitest runs from the package root; import.meta.url isn't a file URL under happy-dom.
	const html = readFileSync(join(process.cwd(), 'fixtures', name), 'utf8');
	return parseRatingsPage(new DOMParser().parseFromString(html, 'text/html'));
}
