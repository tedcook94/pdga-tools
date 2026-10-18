import { describe, expect, it } from 'vitest';
import { groupDivisions } from './divisions.ts';

describe('groupDivisions', () => {
	it('orders Pro, Amateur, Junior, then Other', () => {
		const groups = groupDivisions(['RAH', 'MJ15', 'MA1', 'MPO']);
		expect(groups.map((g) => g.label)).toEqual(['Pro', 'Amateur', 'Junior', 'Other']);
	});

	it('sorts mixed before female, then open before age divisions', () => {
		const [pro] = groupDivisions(['FP40', 'MP50', 'FPO', 'MP40', 'MPO']);
		expect(pro.codes).toEqual(['MPO', 'MP40', 'MP50', 'FPO', 'FP40']);
	});

	it('sorts amateur levels before age divisions', () => {
		const [am] = groupDivisions(['MA40', 'MA2', 'MA1', 'FA1']);
		expect(am.codes).toEqual(['MA1', 'MA2', 'MA40', 'FA1']);
	});

	it('drops empty groups and keeps unknown codes', () => {
		expect(groupDivisions(['MSV', 'FC3'])).toEqual([{ label: 'Other', codes: ['FC3', 'MSV'] }]);
	});
});
