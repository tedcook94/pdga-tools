<script lang="ts">
	import DistributionCurve from '#lib/DistributionCurve.svelte';
	import { groupDivisions } from '#lib/divisions.ts';
	import { MAX_RATING, MIN_RATING, isValidRating, ordinal, percentile } from '#lib/percentile.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const TYPING_DELAY_MS = 300;

	// The box and the rating are separate so partial input ("9" on the way to
	// "908") doesn't move the marker; the rating catches up once typing pauses.
	let typed = $state<number | null>(null);
	let rating = $state<number | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function applyTyped() {
		clearTimeout(timer);
		rating = typed;
	}

	// Browsers disagree on how spinner clicks report inputType, so text edits
	// are detected from the key or paste that caused them instead. Spinner
	// clicks and arrow-key steps have no such event and apply immediately.
	let textEdit = false;

	function onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') applyTyped();
		// "Unidentified" covers mobile soft keyboards.
		textEdit =
			event.key.length === 1 || ['Backspace', 'Delete', 'Unidentified'].includes(event.key);
	}

	function onInput() {
		clearTimeout(timer);
		if (typed == null || !textEdit) applyTyped();
		else timer = setTimeout(applyTyped, TYPING_DELAY_MS);
		textEdit = false;
	}

	function setFromCurve(value: number | null) {
		clearTimeout(timer);
		rating = value;
		typed = value;
	}

	$effect(() => () => clearTimeout(timer));

	const ALL = '';
	let division = $state(ALL);

	const groups = $derived(groupDivisions(Object.keys(data.month.divisions ?? {})));
	const selected = $derived(
		(division && data.month.divisions?.[division]) || {
			total: data.month.total_players,
			ratings: data.month.ratings
		}
	);

	const result = $derived(rating == null ? null : percentile(selected.ratings, rating));

	const hint = $derived.by(() => {
		if (rating == null) return `Enter a rating from ${MIN_RATING} to ${MAX_RATING}, or drag the curve.`;
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
			bind:value={typed}
			oninput={onInput}
			onblur={applyTyped}
			onkeydown={onKeyDown}
			onpaste={() => (textEdit = true)}
		/>
	</label>

	<section class="card">
		<div class="readout">
			<div aria-live="polite">
				{#if result}
					<p class="percentile">
						{result.percentile.toFixed(1)}<span class="suffix">{ordinal(result.percentile)}</span>
					</p>
				{:else}
					<p class="hint">{hint}</p>
				{/if}
			</div>
			{#if result}
				<p class="label">
					percentile of
					{#if groups.length > 0}
						<span class="picker">
							<span class="picker-text" aria-hidden="true">
								{division || 'all'}
								<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" /></svg>
							</span>
							<!-- Transparent select stretched over the visible text, so clicks
							     anywhere on the code or chevron open the native list. -->
							<select bind:value={division} aria-label="Compare against">
								<option value={ALL}>all</option>
								{#each groups as group (group.label)}
									<optgroup label={group.label}>
										{#each group.codes as code (code)}
											<option value={code}>{code}</option>
										{/each}
									</optgroup>
								{/each}
							</select>
						</span>
					{:else}
						all
					{/if}
					players
				</p>
			{/if}
		</div>

		<DistributionCurve ratings={selected.ratings} bind:rating={() => rating, setFromCurve} valid={result != null} />

		{#if result}
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
		{/if}
	</section>

	<div class="meta">
		<p>Ratings as of {updateDate}</p>
		<p>
			{count(selected.total)} active {division ? `${division} ` : ''}players whose rating changed
			in the last {data.month.active_window_months} months
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
		gap: var(--size-4);
	}

	/* Fixed height so the curve doesn't jump when the hint swaps for a result. */
	.readout {
		min-block-size: 6rem;
		display: grid;
		gap: var(--size-2);
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
		color: var(--text-2);
	}

	.picker {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.15em;
		color: var(--accent);
		font-weight: var(--font-weight-7);
		border-block-end: var(--border-size-2) dotted currentColor;
		cursor: pointer;
	}

	.picker:hover,
	.picker:focus-within {
		border-block-end-style: solid;
	}

	.picker:has(select:focus-visible) {
		outline: var(--border-size-2) solid var(--accent);
		outline-offset: var(--size-1);
		border-radius: var(--radius-1);
	}

	.picker-text {
		display: inline-flex;
		align-items: center;
		gap: 0.15em;
	}

	select {
		position: absolute;
		inset: 0;
		inline-size: 100%;
		block-size: 100%;
		opacity: 0;
		appearance: none;
		padding: 0;
		font: inherit;
		border: none;
		cursor: pointer;
	}

	select:focus-visible {
		outline: none;
	}

	/* Options render in a native popup that ignores the page's text color. */
	option,
	optgroup {
		color: initial;
		font-weight: normal;
	}

	.picker svg {
		inline-size: 0.75em;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
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
