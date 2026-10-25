export interface LocationOption {
	key: string;
	label: string;
	name: string;
	ariaLabel: string;
}

export interface LocationGroup {
	label: string;
	options: LocationOption[];
}

const STATES: Record<string, string> = {
	AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
	CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
	FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
	IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
	ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
	MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
	NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
	NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
	PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
	TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
	WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

const PROVINCES: Record<string, string> = {
	AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
	NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
	NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
	SK: 'Saskatchewan', YT: 'Yukon'
};

const SUBDIVISIONS: Record<string, Record<string, string>> = { US: STATES, CA: PROVINCES };

// Countries whose names read naturally with "the" in "players in ___".
const WITH_THE = new Set(['US', 'GB', 'NL', 'PH', 'AE', 'DO', 'BS']);

const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'code' });

export function countryName(code: string): string {
	if (code === 'US') return 'United States';
	try {
		return countryNames.of(code) ?? code;
	} catch {
		return code;
	}
}

export function locationName(key: string): string {
	const [country, sub] = key.split('-');
	if (sub) return SUBDIVISIONS[country]?.[sub] ?? sub;
	const name = countryName(country);
	return WITH_THE.has(country) ? `the ${name}` : name;
}

const byLabel = (a: LocationOption, b: LocationOption) => a.label.localeCompare(b.label, 'en');

function option(key: string, label: string): LocationOption {
	const name = locationName(key);
	return { key, label, name, ariaLabel: label === 'All' ? `All of ${name}` : name };
}

/**
 * Groups location keys for the picker: the United States and Canada first,
 * each with an "All" option and their states or provinces, then every other
 * country alphabetically. "the world" isn't a key and is added by the page.
 */
export function groupLocations(keys: Iterable<string>): LocationGroup[] {
	const all = new Set(keys);
	const groups: LocationGroup[] = [];

	for (const country of ['US', 'CA']) {
		const subs = [...all]
			.filter((k) => k.startsWith(`${country}-`))
			.map((k) => option(k, locationName(k)))
			.sort(byLabel);
		if (!all.has(country) && subs.length === 0) continue;
		const options = all.has(country) ? [option(country, 'All'), ...subs] : subs;
		groups.push({ label: countryName(country), options });
	}

	const others = [...all]
		.filter((k) => !k.includes('-') && k !== 'US' && k !== 'CA')
		.map((k) => option(k, countryName(k)))
		.sort(byLabel);
	if (others.length > 0) groups.push({ label: 'Other countries', options: others });

	return groups;
}
