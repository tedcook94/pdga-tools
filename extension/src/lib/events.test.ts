import { describe, expect, it } from 'vitest';
import { eventDate, validateEvent, type AddedEvent } from './events';

const tournament = (rounds: AddedEvent['rounds']): AddedEvent => ({
	id: 't',
	kind: 'tournament',
	name: 'Tournament',
	endDate: null,
	rounds
});

const league = (endDate: string | null, rounds: AddedEvent['rounds']): AddedEvent => ({
	id: 'l',
	kind: 'league',
	name: 'League',
	endDate,
	rounds
});

describe('eventDate', () => {
	it('dates a tournament by its latest round', () => {
		const event = tournament([
			{ id: '1', date: '2026-09-05', rating: 900 },
			{ id: '2', date: '2026-09-07', rating: 900 },
			{ id: '3', date: '2026-09-06', rating: 900 }
		]);
		expect(eventDate(event)).toBe('2026-09-07');
	});

	it('dates a league by its end date, ignoring round dates', () => {
		const event = league('2026-12-12', [
			{ id: '1', date: '2026-10-03', rating: 900 },
			{ id: '2', date: null, rating: 900 }
		]);
		expect(eventDate(event)).toBe('2026-12-12');
	});

	it('has no date without one', () => {
		expect(eventDate(tournament([]))).toBeNull();
		expect(eventDate(league(null, []))).toBeNull();
	});
});

describe('validateEvent', () => {
	it('accepts a complete tournament and league', () => {
		expect(validateEvent(tournament([{ id: '1', date: '2026-11-13', rating: 868 }]))).toEqual([]);
		expect(
			validateEvent(league('2026-12-12', [{ id: '1', date: '2026-10-03', rating: 918 }]))
		).toEqual([]);
	});

	it('requires league round dates for the rating window', () => {
		expect(validateEvent(league('2026-12-12', [{ id: '1', date: null, rating: 918 }]))).toEqual([
			'Every round needs a date.'
		]);
	});

	it('rejects league rounds after the end date', () => {
		expect(
			validateEvent(league('2026-12-12', [{ id: '1', date: '2026-12-13', rating: 918 }]))
		).toEqual(["Round dates can't be after the league's end date."]);
	});

	it('requires a league end date', () => {
		expect(validateEvent(league(null, [{ id: '1', date: '2026-10-03', rating: 918 }]))).toEqual([
			'A league needs an end date.'
		]);
	});

	it('requires tournament round dates', () => {
		expect(validateEvent(tournament([{ id: '1', date: null, rating: 868 }]))).toEqual([
			'Every round needs a date.'
		]);
	});

	it('requires rounds', () => {
		expect(validateEvent(tournament([]))).toEqual(['Add at least one round.']);
	});

	it('accepts skipped round numbers', () => {
		const rounds = [
			{ id: '1', date: '2026-10-03', rating: 900, number: 1 },
			{ id: '2', date: '2026-10-17', rating: 900, number: 3 }
		];
		expect(validateEvent(tournament(rounds))).toEqual([]);
	});

	it('rejects repeated round numbers', () => {
		const rounds = [
			{ id: '1', date: '2026-10-03', rating: 900, number: 2 },
			{ id: '2', date: '2026-10-17', rating: 900 }
		];
		expect(validateEvent(tournament(rounds))).toEqual(['Round numbers must be different.']);
	});

	it.each([0, 1.5])('rejects round number %s', (number) => {
		expect(
			validateEvent(tournament([{ id: '1', date: '2026-11-13', rating: 868, number }]))
		).toEqual(['Round numbers must be whole numbers above 0.']);
	});

	it.each([0, 18.5])('rejects %s holes', (holes) => {
		expect(
			validateEvent(tournament([{ id: '1', date: '2026-11-13', rating: 868, holes }]))
		).toEqual(['Hole counts must be whole numbers above 0.']);
	});

	it.each([null, 899.5, -1, 1301])('rejects a rating of %s', (rating) => {
		expect(validateEvent(tournament([{ id: '1', date: '2026-11-13', rating }]))).toEqual([
			'Every round needs a whole-number rating from 0 to 1300.'
		]);
	});
});
