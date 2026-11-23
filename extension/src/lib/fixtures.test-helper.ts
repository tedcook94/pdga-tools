import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRatingsPage, type RatingsPage } from './ratings-page';

/** Loads a trimmed page from `extension/fixtures/`. */
export function loadDocument(name: string): Document {
	// Vitest runs from the package root; import.meta.url isn't a file URL under happy-dom.
	const html = readFileSync(join(process.cwd(), 'fixtures', name), 'utf8');
	return new DOMParser().parseFromString(html, 'text/html');
}

/** Parses a trimmed ratings detail page from `extension/fixtures/`. */
export function loadFixture(name: string): RatingsPage {
	return parseRatingsPage(loadDocument(name));
}
