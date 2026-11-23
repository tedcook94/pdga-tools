/** A rated round as listed in the ratings detail table on pdga.com. */
export interface PageRound {
	eventId: number | null;
	eventName: string;
	/** Tier code, such as "C", "B", "A", "XC" or "L" for leagues. */
	tier: string;
	/** ISO date (YYYY-MM-DD). Equals `endDate` for single-day events. */
	startDate: string;
	/** ISO date (YYYY-MM-DD). PDGA dates multi-day events and leagues by their end. */
	endDate: string;
	division: string;
	/** Round label, usually a number but sometimes "Finals". */
	round: string;
	score: number | null;
	rating: number;
	/** Holes in the round's layout; the rating weights rounds by holes ÷ 18. */
	holes: number;
	/** Considered for the current rating (inside the rating window). */
	evaluated: boolean;
	/** Counted in the current rating (evaluated and not dropped as an outlier). */
	included: boolean;
}

/** What the extension reads from a ratings detail page. */
export interface RatingsPage {
	rating: number | null;
	/** ISO date of the ratings update the page reflects. */
	ratingDate: string | null;
	rounds: PageRound[];
}

const MONTHS: Record<string, number> = {
	jan: 1,
	feb: 2,
	mar: 3,
	apr: 4,
	may: 5,
	jun: 6,
	jul: 7,
	aug: 8,
	sep: 9,
	oct: 10,
	nov: 11,
	dec: 12
};

function isoDate(year: number, month: number, day: number): string {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Parses a PDGA date such as "17-Oct-2026" into an ISO date. */
export function parseDate(text: string): string | null {
	const match = text.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
	const month = match && MONTHS[match[2]!.toLowerCase()];
	if (!match || !month) return null;
	return isoDate(Number(match[3]), month, Number(match[1]));
}

/**
 * Parses a PDGA date cell, either a single date ("17-Oct-2026") or a range
 * ("2-Apr to 4-Jun-2026"). Ranges omit the start year when it matches the end year.
 */
export function parseDateRange(text: string): { start: string; end: string } | null {
	const [startText, endText, ...rest] = text.split(/\s+to\s+/);
	if (rest.length > 0 || !startText) return null;
	if (endText === undefined) {
		const date = parseDate(startText);
		return date ? { start: date, end: date } : null;
	}

	const end = parseDate(endText);
	if (!end) return null;
	const start = parseDate(startText);
	if (start) return { start, end };

	const match = startText.trim().match(/^(\d{1,2})-([A-Za-z]{3})$/);
	const month = match && MONTHS[match[2]!.toLowerCase()];
	if (!match || !month) return null;
	const endYear = Number(end.slice(0, 4));
	const endMonth = Number(end.slice(5, 7));
	// "28-Dec to 4-Jan-2027" without a start year spans the new year.
	const year = month > endMonth ? endYear - 1 : endYear;
	return { start: isoDate(year, month, Number(match[1])), end };
}

/** The trimmed text of a row's cell with the given class, empty if missing. */
export function cellText(row: Element, name: string): string {
	return row.querySelector(`td.${name}`)?.textContent?.trim() ?? '';
}

/** Holes assumed for a round whose layout isn't listed. */
export const STANDARD_HOLES = 18;

/**
 * Hole counts by layout tooltip id. The tooltips ("Course - Layout; 18 holes;
 * Par 54; ...") sit outside the table, and round cells point to them by id.
 */
export function layoutHoles(doc: ParentNode): Map<string, number> {
	const holes = new Map<string, number>();
	for (const layout of doc.querySelectorAll('[id^="layout-details-"]')) {
		const count = layout.textContent?.match(/(\d+) holes/)?.[1];
		if (count) holes.set(layout.id, Number(count));
	}
	return holes;
}

function parseRound(row: Element, holesById: Map<string, number>): PageRound | null {
	const dates = parseDateRange(cellText(row, 'date'));
	const rating = Number.parseInt(cellText(row, 'round-rating'), 10);
	if (!dates || Number.isNaN(rating)) return null;

	const href = row.querySelector('td.tournament a')?.getAttribute('href') ?? '';
	const eventId = href.match(/\/tour\/event\/(\d+)/)?.[1];
	const score = Number.parseInt(cellText(row, 'score'), 10);
	const layoutId = row
		.querySelector('td.round')
		?.getAttribute('data-tooltip-content')
		?.replace(/^#/, '');

	return {
		eventId: eventId ? Number(eventId) : null,
		eventName: cellText(row, 'tournament'),
		tier: cellText(row, 'tier'),
		startDate: dates.start,
		endDate: dates.end,
		division: cellText(row, 'division'),
		round: cellText(row, 'round'),
		score: Number.isNaN(score) ? null : score,
		rating,
		holes: (layoutId && holesById.get(layoutId)) || STANDARD_HOLES,
		evaluated: cellText(row, 'evaluated') === 'Yes',
		included: cellText(row, 'included') === 'Yes'
	};
}

/** Reads the current rating and rated rounds from a pdga.com ratings detail page. */
export function parseRatingsPage(doc: ParentNode): RatingsPage {
	const ratingLine = doc.querySelector('li.current-rating');
	const rating = ratingLine?.textContent?.match(/Current Rating:\s*(\d+)/)?.[1];
	const ratingDate = ratingLine
		?.querySelector('.rating-date')
		?.textContent?.match(/as of\s+([^)]+)\)/)?.[1];

	// Other rating extensions insert their own rows into this table; PDGA's rows
	// always carry an evaluated or not-evaluated class.
	const rows = doc.querySelectorAll(
		'#player-results-details tbody tr.evaluated, #player-results-details tbody tr.not-evaluated'
	);

	const holesById = layoutHoles(doc);

	return {
		rating: rating ? Number(rating) : null,
		ratingDate: ratingDate ? parseDate(ratingDate) : null,
		rounds: [...rows].flatMap((row) => parseRound(row, holesById) ?? [])
	};
}
