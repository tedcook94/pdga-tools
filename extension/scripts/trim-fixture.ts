// Trims a saved pdga.com ratings detail page down to what the parser reads:
// the current rating line and the ratings detail table. Strips the player's
// name, PDGA number, and event names so fixtures don't republish profile data.
//
// Usage: node scripts/trim-fixture.ts <saved-page.html> <fixtures/out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
	console.error('usage: node scripts/trim-fixture.ts <saved-page.html> <out.html>');
	process.exit(2);
}

const html = readFileSync(input, 'utf8');

function extract(pattern: RegExp, label: string): string {
	const match = html.match(pattern);
	if (!match) {
		console.error(`${input}: ${label} not found`);
		process.exit(1);
	}
	return match[0];
}

const ratingLine = extract(/<li class="current-rating">[\s\S]*?<\/li>/, 'current rating')
	.replace(/\/player\/\d+\//g, '/player/0/');
// Event names and IDs together with dates would identify the player, so
// renumber events in order of appearance and name them after the new number.
const eventIds = new Map<string, number>();
function anonymousId(id: string): number {
	if (!eventIds.has(id)) eventIds.set(id, eventIds.size + 1);
	return eventIds.get(id)!;
}

const table = extract(/<table id="player-results-details"[\s\S]*?<\/table>/, 'ratings table')
	.replace(
		/<td class="tournament"><a href="\/tour\/event\/(\d+)">[^<]*<\/a><\/td>/g,
		(_, id: string) => {
			const n = anonymousId(id);
			return `<td class="tournament"><a href="/tour/event/${n}">Event ${n}</a></td>`;
		}
	)
	.replace(/layout-details-(\d+)-/g, (_, id: string) => `layout-details-${anonymousId(id)}-`);

writeFileSync(
	output,
	`<!doctype html>
<html>
<body>
<ul class="player-info info-list">${ratingLine}</ul>
<div class="table-container">${table}</div>
</body>
</html>
`
);
