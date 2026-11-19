import { roundNumber, type AddedEvent, type AddedRound, type EventKind } from './events';
import type { CalcRound } from './projection';

export function newEvent(kind: EventKind): AddedEvent {
	return { id: crypto.randomUUID(), kind, name: '', endDate: null, rounds: [newRound([])] };
}

/**
 * A blank round following the last one: next number, same date, since rounds
 * are usually entered in order. Either can be changed for a missed week.
 */
export function newRound(rounds: readonly AddedRound[]): AddedRound {
	const last = rounds.at(-1);
	return {
		id: crypto.randomUUID(),
		number: last ? roundNumber(last, rounds.length - 1) + 1 : 1,
		date: last?.date ?? null,
		rating: null
	};
}

/** Reads a number field: empty is null, anything else as typed for validation to judge. */
export function numberValue(input: HTMLInputElement): number | null {
	return input.value.trim() === '' ? null : Number(input.value);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-12-08" → "8 Dec 2026". */
export function formatDate(iso: string): string {
	const [year, month, day] = iso.split('-').map(Number);
	return `${day} ${MONTHS[month! - 1]} ${year}`;
}

export function formatChange(change: number): string {
	return change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0';
}

/** Short name for a round in the timeline, such as "Event 3 R2". */
export function roundLabel(round: CalcRound): string {
	if (round.source === 'page') return `${round.page.eventName} R${round.page.round}`;
	const index = round.event.rounds.indexOf(round.round);
	return `${round.event.name.trim() || 'Untitled'} R${roundNumber(round.round, index)}`;
}
