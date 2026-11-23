// Trims a saved pdga.com event page down to what the parser reads for one
// player: the event info, that player's results row and its layouts' hole
// counts. Every other player, all names, PDGA numbers and event IDs are removed.
//
// Usage: node scripts/trim-event-fixture.ts <saved-page.html> <pdga-number> <fixtures/out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [input, player, output] = process.argv.slice(2);
if (!input || !player || !/^\d+$/.test(player) || !output) {
	console.error('usage: node scripts/trim-event-fixture.ts <saved-page.html> <pdga-number> <out.html>');
	process.exit(2);
}

const FIXTURE_PLAYER = '1';
const FIXTURE_EVENT = '1';

const html = readFileSync(input, 'utf8');

function extract(source: string, pattern: RegExp, label: string): string {
	const match = source.match(pattern);
	if (!match) {
		console.error(`${input}: ${label} not found`);
		process.exit(1);
	}
	return match[1] ?? match[0];
}

const eventId = extract(html, /<link rel="canonical" href="[^"]*\/tour\/event\/(\d+)"/, 'event ID');
const type = extract(html, /pane-tournament-event-info"[\s\S]*?(<h4>[^<]*<\/h4>)/, 'event type');
const date = extract(html, /<li class="tournament-date">[\s\S]*?<\/li>/, 'event date');

// Doubles rows add classes such as "odd" to every cell.
const playerCell = new RegExp(`(<td class="[^"]*\\bpdga-number">)${player}</td>`, 'g');
const isPlayer = (source: string) => new RegExp(playerCell.source).test(source);
const tables = html.match(/<table class="results[\s\S]*?<\/table>/g) ?? [];
const table = tables.find(isPlayer) ?? extract('', /./, `player ${player}`);
const head = extract(table, /<thead>[\s\S]*?<\/thead>/, 'results header');
const row = (table.match(/<tr[\s\S]*?<\/tr>/g) ?? []).find(isPlayer)!;

const anonymize = (source: string) =>
	source
		.replace(/(<td class="[^"]*\bplayer">)[\s\S]*?<\/td>/, '$1Player</td>')
		.replace(playerCell, `$1${FIXTURE_PLAYER}</td>`)
		.replaceAll(`/live/event/${eventId}/`, `/live/event/${FIXTURE_EVENT}/`)
		.replaceAll(`layout-details-${eventId}-`, `layout-details-${FIXTURE_EVENT}-`);

// Course and layout names would locate the player, so only hole counts stay.
const layoutIds = new Set([...head.matchAll(/data-tooltip-content="#([^"]+)"/g)].map(([, id]) => id));
const layouts = [...html.matchAll(/<div id="(layout-details-[^"]+)"><div>([\s\S]*?)<\/div>/g)]
	.filter(([, id]) => layoutIds.has(id))
	.flatMap(([, id, details]) => {
		const holes = details!.match(/(\d+) holes/)?.[1];
		return holes ? `<div id="${anonymize(id!)}"><div>${holes} holes</div></div>` : [];
	})
	.join('\n');

const trimmed = `<!doctype html>
<html>
<body>
<h1 class="title" id="page-title">Event ${FIXTURE_EVENT}</h1>
<div class="panel-pane pane-tournament-event-info"><div class="pane-content">
${type}<ul class="event-info info-list">${date}</ul>
</div></div>
<div class="tooltip-templates">
${layouts}
</div>
<table class="results sticky-enabled">
${anonymize(head)}
<tbody>
${anonymize(row)}
</tbody>
</table>
</body>
</html>
`;

for (const identifier of [eventId, player]) {
	if (trimmed.includes(identifier)) {
		console.error(`${input}: ${identifier} is still in the trimmed page`);
		process.exit(1);
	}
}
writeFileSync(output, trimmed);
