<script lang="ts">
	import { newRound, numberValue } from '@/lib/editing';
	import { MAX_RATING, MIN_RATING, roundNumber, type AddedEvent } from '@/lib/events';

	interface Props {
		event: AddedEvent;
		problems: string[];
		/** Already in the published rating, so it no longer changes anything. */
		counted: boolean;
		onremove: () => void;
	}

	let { event = $bindable(), problems, counted, onremove }: Props = $props();

	const kindLabel = $derived(event.kind === 'league' ? 'League' : 'Tournament');

	// Fields commit on change (blur, Enter or a picked date) rather than input,
	// so a half-typed rating like "9" doesn't reproject and shift the layout.
	function dateValue(input: HTMLInputElement): string | null {
		return input.value || null;
	}
</script>

<article class="event" class:counted aria-label="{kindLabel} {event.name}">
	<header>
		<span class="kind">{kindLabel}</span>
		<input
			class="name"
			placeholder="Name"
			aria-label="{kindLabel} name"
			value={event.name}
			onchange={(e) => (event.name = e.currentTarget.value)}
		/>
		{#if event.kind === 'league'}
			<label class="end">
				<span>Ends</span>
				<input
					type="date"
					value={event.endDate ?? ''}
					onchange={(e) => (event.endDate = dateValue(e.currentTarget))}
				/>
			</label>
		{/if}
		<button class="remove" type="button" onclick={onremove}>Remove</button>
	</header>

	{#if counted}
		<p class="note">Already counted in your current rating.</p>
	{/if}

	<div class="rounds" role="table" aria-label="{kindLabel} rounds">
		<div class="row head" role="row">
			<span role="columnheader">Round</span>
			<span role="columnheader">Date</span>
			<span role="columnheader">Rating</span>
			<span role="columnheader">Holes</span>
			<span></span>
		</div>
		{#each event.rounds as round, index (round.id)}
			{@const number = roundNumber(round, index)}
			<div class="row" role="row">
				<input
					type="number"
					inputmode="numeric"
					aria-label="Round {number} number"
					min="1"
					value={number}
					onchange={(e) => (round.number = numberValue(e.currentTarget) ?? undefined)}
				/>
				<input
					type="date"
					aria-label="Round {number} date"
					value={round.date ?? ''}
					onchange={(e) => (round.date = dateValue(e.currentTarget))}
				/>
				<input
					type="number"
					inputmode="numeric"
					aria-label="Round {number} rating"
					min={MIN_RATING}
					max={MAX_RATING}
					value={round.rating ?? ''}
					onchange={(e) => (round.rating = numberValue(e.currentTarget))}
				/>
				<input
					type="number"
					inputmode="numeric"
					aria-label="Round {number} holes"
					min="1"
					placeholder="18"
					value={round.holes ?? ''}
					onchange={(e) => (round.holes = numberValue(e.currentTarget) ?? undefined)}
				/>
				<button
					type="button"
					class="delete"
					title="Delete round {number}"
					aria-label="Delete round {number}"
					onclick={() => event.rounds.splice(index, 1)}>×</button
				>
			</div>
		{/each}
	</div>
	<button type="button" class="add" onclick={() => event.rounds.push(newRound(event.rounds))}
		>+ Round</button
	>

	{#if problems.length > 0}
		<ul class="problems">
			{#each problems as problem (problem)}
				<li>{problem}</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
	.event {
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
	}

	.counted {
		opacity: 0.5;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.kind {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.name {
		flex: 1;
		min-width: 10rem;
		font-weight: 600;
	}

	.end {
		display: flex;
		gap: 6px;
		align-items: center;
		color: var(--muted);
	}

	.remove {
		padding: 0;
		border: none;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 13px;
		cursor: pointer;
	}

	.remove:hover {
		color: var(--danger);
		text-decoration: underline;
	}

	.note {
		margin: 8px 0 0;
		font-size: 13px;
		color: var(--muted);
	}

	.rounds {
		display: grid;
		gap: 6px;
		margin-top: 10px;
	}

	.row {
		display: grid;
		grid-template-columns: 4rem 9.5rem 5rem 4rem 1.75rem;
		gap: 8px;
		align-items: center;
	}

	.head {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.delete {
		width: 1.75rem;
		height: 1.75rem;
		border: none;
		border-radius: 6px;
		background: none;
		color: var(--muted);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}

	.delete:hover {
		background: var(--danger-soft);
		color: var(--danger);
	}

	.add {
		margin-top: 8px;
	}

	.problems {
		margin: 10px 0 0;
		padding-left: 1.2rem;
		font-size: 13px;
		color: var(--danger);
	}
</style>
