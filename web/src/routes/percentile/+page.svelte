<script lang="ts">
	import { MAX_RATING, MIN_RATING, isValidRating, ordinal, percentile } from '#lib/percentile.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let rating = $state<number | null>(null);

	const result = $derived(rating == null ? null : percentile(data.month.ratings, rating));

	const hint = $derived.by(() => {
		if (rating == null) return `Enter a rating from ${MIN_RATING} to ${MAX_RATING}.`;
		if (!Number.isInteger(rating)) return 'Ratings are whole numbers.';
		if (!isValidRating(rating)) return `Ratings range from ${MIN_RATING} to ${MAX_RATING}.`;
		return '';
	});

	const count = (n: number) => n.toLocaleString('en-US');

	// The date is a calendar day; formatting in UTC keeps it from shifting a day
	// in time zones west of UTC.
	const updateDate = $derived(
		new Date(data.month.ratings_update).toLocaleDateString('en-US', {
			dateStyle: 'long',
			timeZone: 'UTC'
		})
	);
</script>

<svelte:head>
	<title>PDGA Rating Percentile</title>
</svelte:head>

<main>
	<header>
		<h1>PDGA Rating Percentile</h1>
		<p class="lead">How does your rating compare to other active PDGA players?</p>
	</header>

	<label>
		<span>Your rating</span>
		<input
			type="number"
			inputmode="numeric"
			min={MIN_RATING}
			max={MAX_RATING}
			step="1"
			placeholder="900"
			bind:value={rating}
		/>
	</label>

	<section class="card" aria-live="polite">
		{#if result}
			<p class="percentile">
				{result.percentile.toFixed(1)}<span class="suffix">{ordinal(result.percentile)}</span>
			</p>
			<p class="label">percentile</p>

			<div class="bar" aria-hidden="true">
				<div class="fill" style:inline-size="{result.percentile}%"></div>
				<div class="marker" style:inset-inline-start="{result.percentile}%"></div>
			</div>

			<dl class="stats">
				<div>
					<dt>Below</dt>
					<dd>{count(result.below)}</dd>
				</div>
				<div>
					<dt>Same</dt>
					<dd>{count(result.equal)}</dd>
				</div>
				<div>
					<dt>Above</dt>
					<dd>{count(result.above)}</dd>
				</div>
			</dl>
		{:else}
			<p class="hint">{hint}</p>
		{/if}
	</section>

	<div class="meta">
		<p>Ratings as of {updateDate}</p>
		<p>
			{count(data.month.total_players)} active players whose rating changed in the last
			{data.month.active_window_months} months
		</p>
	</div>
</main>

<style>
	main {
		inline-size: 100%;
		max-inline-size: 48rem;
		margin-inline: auto;
		padding: var(--size-8) var(--size-4) var(--size-6);
		display: grid;
		gap: var(--size-6);
		align-content: start;
		justify-items: center;
		text-align: center;
	}

	label,
	.card {
		inline-size: 100%;
		max-inline-size: 32rem;
	}

	header {
		display: grid;
		gap: var(--size-2);
	}

	h1 {
		max-inline-size: none;
		font-size: clamp(var(--font-size-5), 6vw, var(--font-size-7));
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		background-clip: text;
		color: transparent;
	}

	p {
		max-inline-size: none;
		margin-inline: auto;
	}

	.lead {
		color: var(--text-2);
	}

	label {
		display: grid;
		gap: var(--size-2);
		justify-items: center;
	}

	label span {
		font-size: var(--font-size-0);
		font-weight: var(--font-weight-6);
		letter-spacing: var(--font-letterspacing-3);
		text-transform: uppercase;
		color: var(--text-2);
	}

	input {
		inline-size: 8ch;
		padding: var(--size-2) var(--size-3);
		font-size: var(--font-size-6);
		font-weight: var(--font-weight-7);
		text-align: center;
		border: var(--border-size-2) solid var(--field-border);
		border-radius: var(--radius-3);
		background: var(--field-bg);
		backdrop-filter: blur(12px);
		transition: border-color 0.2s var(--ease-3), box-shadow 0.2s var(--ease-3);
	}

	input:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 var(--size-1) color-mix(in oklab, var(--accent) 30%, transparent);
	}

	.card {
		min-block-size: 15rem;
		align-content: center;
	}

	.percentile {
		font-size: var(--font-size-fluid-3);
		font-weight: var(--font-weight-9);
		line-height: var(--font-lineheight-00);
		font-variant-numeric: tabular-nums;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		background-clip: text;
		color: transparent;
	}

	.suffix {
		font-size: 0.4em;
		vertical-align: super;
	}

	.label {
		margin-block-start: calc(var(--size-2) * -1);
		color: var(--text-2);
	}

	.bar {
		position: relative;
		block-size: var(--size-2);
		margin-block: var(--size-3);
		border-radius: var(--radius-round);
		background: var(--track);
	}

	.fill {
		block-size: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		transition: inline-size 0.4s var(--ease-out-3);
	}

	.marker {
		position: absolute;
		inset-block-start: 50%;
		inline-size: var(--size-4);
		block-size: var(--size-4);
		translate: -50% -50%;
		border: var(--border-size-3) solid var(--accent-2);
		border-radius: var(--radius-round);
		background: var(--surface-1);
		transition: inset-inline-start 0.4s var(--ease-out-3);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--size-3);
	}

	dt {
		font-size: var(--font-size-00);
		font-weight: var(--font-weight-6);
		letter-spacing: var(--font-letterspacing-3);
		text-transform: uppercase;
		color: var(--text-2);
	}

	dd {
		margin: 0;
		font-size: var(--font-size-3);
		font-weight: var(--font-weight-7);
		font-variant-numeric: tabular-nums;
	}

	.hint {
		color: var(--text-2);
	}

	.meta {
		display: grid;
		gap: var(--size-1);
		font-size: var(--font-size-0);
		color: var(--text-2);
	}
</style>
