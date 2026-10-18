export interface DivisionGroup {
	label: string;
	codes: string[];
}

const GROUPS = ['Pro', 'Amateur', 'Junior', 'Other'] as const;
type Group = (typeof GROUPS)[number];

interface Parsed {
	group: Group;
	gender: number;
	number: number;
}

// Standard codes look like MPO, FP40, MA2, FA50, MJ15. Anything else (MC1,
// RAH, MSV, ...) goes in Other so new or unusual codes still show up.
function parse(code: string): Parsed {
	const match = /^([MF])([PAJ])(O|\d+)$/.exec(code);
	if (!match) return { group: 'Other', gender: 0, number: 0 };
	const [, gender, kind, rest] = match;
	const number = rest === 'O' ? 0 : Number(rest);
	const group: Group = kind === 'P' ? 'Pro' : kind === 'A' ? 'Amateur' : 'Junior';
	return { group, gender: gender === 'M' ? 0 : 1, number };
}

export function groupDivisions(codes: Iterable<string>): DivisionGroup[] {
	const parsed = [...codes].map((code) => ({ code, ...parse(code) }));
	return GROUPS.map((label) => ({
		label,
		codes: parsed
			.filter((d) => d.group === label)
			.sort((a, b) => a.gender - b.gender || a.number - b.number || a.code.localeCompare(b.code))
			.map((d) => d.code)
	})).filter((g) => g.codes.length > 0);
}
