import { describe, expect, it } from 'vitest';
import { groupLocations, locationName } from './locations.ts';

describe('groupLocations', () => {
	const groups = groupLocations(['FI', 'US-TX', 'CA', 'US', 'CA-ON', 'US-AL', 'PR', 'DE']);

	it('orders United States, Canada, then other countries', () => {
		expect(groups.map((g) => g.label)).toEqual(['United States', 'Canada', 'Other countries']);
	});

	it('puts "All" first, then states by name', () => {
		expect(groups[0].options.map((o) => o.label)).toEqual(['All', 'Alabama', 'Texas']);
		expect(groups[0].options[0].key).toBe('US');
	});

	it('sorts other countries by name, not code', () => {
		expect(groups[2].options.map((o) => o.key)).toEqual(['FI', 'DE', 'PR']);
	});

	it('labels "All" for screen readers and names it in the sentence', () => {
		const [all] = groups[0].options;
		expect(all.ariaLabel).toBe('All of the United States');
		expect(all.name).toBe('the United States');
		expect(groups[1].options[0].ariaLabel).toBe('All of Canada');
	});

	it('drops empty groups', () => {
		expect(groupLocations(['FI']).map((g) => g.label)).toEqual(['Other countries']);
	});
});

describe('locationName', () => {
	it('names states, provinces, and countries', () => {
		expect(locationName('US-AL')).toBe('Alabama');
		expect(locationName('CA-QC')).toBe('Quebec');
		expect(locationName('FI')).toBe('Finland');
		expect(locationName('GB')).toBe('the United Kingdom');
		expect(locationName('CZ')).toBe('Czechia');
	});

	it('falls back to the code for unknown keys', () => {
		expect(locationName('US-ZZ')).toBe('ZZ');
		expect(locationName('XX')).toBe('XX');
	});
});
