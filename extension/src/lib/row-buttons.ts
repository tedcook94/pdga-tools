import { cellText } from './ratings-page';
import type { PageImportResult } from './page-import';

const COLUMN = 'rating-projector';

const STYLE = `
button {
	display: grid;
	place-items: center;
	width: 22px;
	height: 22px;
	padding: 0;
	border: 0;
	border-radius: 4px;
	background: none;
	color: #13395b;
	cursor: pointer;
}
button:hover:not(:disabled) { background: #e7eef5; }
button:disabled { opacity: 0.4; cursor: default; }
button.done { color: #17784a; }
button.failed { color: #b42318; }
svg {
	width: 16px;
	height: 16px;
	fill: none;
	stroke: currentColor;
	stroke-width: 2;
	stroke-linecap: round;
	stroke-linejoin: round;
}
`;

const ICONS = {
	import: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
	update: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
	done: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	failed: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.01"/>'
};

function setIcon(button: HTMLButtonElement, icon: keyof typeof ICONS) {
	button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
}

const roundsText = (count: number) => (count === 1 ? '1 rated round' : `${count} rated rounds`);

function hasRatedRound(row: Element): boolean {
	return [...row.querySelectorAll('td.round-rating')].some((cell) =>
		/\d/.test(cell.textContent ?? '')
	);
}

/** A header cell for the new column, placed after PDGA# like the body cells. */
function addHeaderCell(table: Element | null) {
	const pdgaHeader = table?.querySelector(':scope > thead th.pdga-number');
	if (!pdgaHeader || pdgaHeader.nextElementSibling?.classList.contains(COLUMN)) return;
	const th = pdgaHeader.ownerDocument.createElement('th');
	th.className = COLUMN;
	th.title = 'Import into Rating Projector';
	th.style.width = '22px';
	pdgaHeader.after(th);
}

function rowButton(
	doc: Document,
	player: string,
	imported: Set<string>,
	onimport: (player: string) => Promise<PageImportResult>
): HTMLElement {
	const host = doc.createElement('span');
	const shadow = host.attachShadow({ mode: 'open' });
	const style = doc.createElement('style');
	style.textContent = STYLE;
	const button = doc.createElement('button');
	button.type = 'button';

	const showIdle = () => {
		const update = imported.has(player);
		setIcon(button, update ? 'update' : 'import');
		button.className = '';
		button.title = `${update ? 'Update' : 'Import'} #${player}'s rounds in Rating Projector`;
		button.setAttribute('aria-label', button.title);
	};
	showIdle();

	button.addEventListener('click', async () => {
		button.disabled = true;
		const result = await onimport(player);
		button.disabled = false;
		if (result.ok) {
			imported.add(player);
			const where = result.localOnly ? ', saved on this device only' : '';
			setIcon(button, 'done');
			button.className = 'done';
			button.title =
				`${result.updated ? 'Updated' : 'Imported'} ${roundsText(result.rounds)}${where}. ` +
				`See the projection on #${player}'s ratings page, or click to update again.`;
		} else {
			setIcon(button, 'failed');
			button.className = 'failed';
			button.title = `${result.error} Click to try again.`;
		}
		button.setAttribute('aria-label', button.title);
	});

	shadow.append(style, button);
	return host;
}

/**
 * Adds a column after PDGA# with an import icon for each player who has rated
 * rounds. Each icon sits in its own shadow root so pdga.com's styles don't
 * reach it. Returns a cleanup that removes the column.
 */
export function addRowButtons(
	doc: Document,
	imported: Set<string>,
	onimport: (player: string) => Promise<PageImportResult>
): () => void {
	const tables = new Set<Element>();
	for (const pdgaCell of doc.querySelectorAll('table.results tbody td.pdga-number')) {
		const row = pdgaCell.parentElement!;
		const table = row.closest('table');
		if (table) tables.add(table);

		const td = doc.createElement('td');
		// Keeps PDGA's odd/even shading, which doubles teams share across two rows.
		td.classList.add(...pdgaCell.classList, COLUMN);
		td.classList.remove('pdga-number');
		const player = cellText(row, 'pdga-number');
		if (/^\d+$/.test(player) && hasRatedRound(row)) {
			td.append(rowButton(doc, player, imported, onimport));
		}
		pdgaCell.after(td);
	}

	for (const table of tables) {
		addHeaderCell(table);
		// Drupal's sticky header is a copy of the thead made before this runs.
		const sticky = table.previousElementSibling;
		if (sticky?.matches('table.sticky-header')) addHeaderCell(sticky);
	}

	return () => doc.querySelectorAll(`.${COLUMN}`).forEach((cell) => cell.remove());
}
