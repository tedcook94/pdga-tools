<script lang="ts">
	import DistributionCurve from '#lib/DistributionCurve.svelte';
	import HistoryTrend from '#lib/HistoryTrend.svelte';
	import InlinePicker from '#lib/InlinePicker.svelte';
	import { loadHistory, loadLocation } from '#lib/data.ts';
	import { historyPoints } from '#lib/history.ts';
	import { groupDivisions } from '#lib/divisions.ts';
	import { groupLocations, locationName } from '#lib/locations.ts';
	import {
		type Counts,
		type HistoryFile,
		type LocationFile,
		MAX_RATING,
		MIN_RATING,
		isValidRating,
		ordinal,
		percentile
	} from '#lib/percentile.ts';
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
	const WORLD = '';
	let division = $state(ALL);
	let location = $state(WORLD);

	// The loaded location's data; null means the world. Kept separate from
	// `location` so the previous numbers stay on screen while a file loads.
	let place = $state<LocationFile | null>(null);
	let loadError = $state(false);

	$effect(() => {
		const key = location;
		loadError = false;
		if (key === WORLD) {
			place = null;
			return;
		}
		let current = true;
		loadLocation(key)
			.then((file) => {
				if (current) place = file;
			})
			.catch(() => {
				if (current) loadError = true;
			});
		return () => {
			current = false;
		};
	});

	const scope = $derived<Counts & { divisions?: Record<string, Counts> }>(
		place
			? { total: place.total_players, ratings: place.ratings, divisions: place.divisions }
			: {
					total: data.month.total_players,
					ratings: data.month.ratings,
					divisions: data.month.divisions
				}
	);

	// A division with no players in the chosen location resets to all.
	$effect(() => {
		if (division !== ALL && place && !place.divisions?.[division]) division = ALL;
	});

	const divisionGroups = $derived(
		groupDivisions(Object.keys(scope.divisions ?? {})).map((g) => ({
			label: g.label,
			options: g.codes.map((code) => ({ value: code, label: code }))
		}))
	);
	const locationGroups = $derived(
		groupLocations(data.month.locations ?? []).map((g) => ({
			label: g.label,
			options: g.options.map((o) => ({ value: o.key, label: o.label, ariaLabel: o.ariaLabel }))
		}))
	);
	const placeName = $derived(place ? locationName(place.location) : 'the world');

	const selected = $derived<Counts>((division && scope.divisions?.[division]) || scope);

	const result = $derived(rating == null ? null : percentile(selected.ratings, rating));

	// Phrases rather than one string, so a narrow card wraps between them.
	// History loads on the first valid rating, so the empty page stays light.
	let history = $state<HistoryFile[] | null>(null);
	let historyRequested = false;
	$effect(() => {
		if (result == null || historyRequested) return;
		historyRequested = true;
		loadHistory()
			.then((files) => (history = files))
			.catch(() => (history = []));
	});
	// Depends on the rating only, so changing a filter doesn't reset the
	// picked year.
	const trend = $derived(
		history && rating != null && isValidRating(rating) ? historyPoints(history, rating) : []
	);
	const filtered = $derived(division !== ALL || location !== WORLD);

	const hint = $derived.by((): string[] => {
		if (rating == null)
			return [`Enter a rating from ${MIN_RATING} to ${MAX_RATING},`, 'or drag the curve.'];
		if (!Number.isInteger(rating)) return ['Ratings are whole numbers.'];
		if (!isValidRating(rating)) return [`Ratings range from ${MIN_RATING} to ${MAX_RATING}.`];
		return [];
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
					<p class="hint">
						{#each hint as phrase, i (i)}<span class="phrase">{phrase}</span>{' '}{/each}
					</p>
				{/if}
			</div>
			{#if result}
				<p class="label">
					<!-- Each half stays on one line, so a long location wraps before "in". -->
					<span class="phrase">
					percentile of
					{#if divisionGroups.length > 0}
						<InlinePicker
							bind:value={division}
							display={division || 'all'}
							ariaLabel="Division"
							top={[{ value: ALL, label: 'all' }]}
							groups={divisionGroups}
						/>
					{:else}
						all
					{/if}
					players
					</span>
					<span class="phrase">
					in
					{#if locationGroups.length > 0}
						<InlinePicker
							bind:value={location}
							display={placeName}
							ariaLabel="Location"
							top={[{ value: WORLD, label: 'the world' }]}
							groups={locationGroups}
						/>
					{:else}
						the world
					{/if}
					</span>
				</p>
				{#if loadError}
					<p class="hint">Couldn't load {locationName(location)}. Showing {placeName}.</p>
				{/if}
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

	{#if result && trend.length > 1}
		<section class="card history">
			<h2>{rating} over the years <span>· all players worldwide</span></h2>
			{#if filtered}
				<p class="note">Division and location filters don't apply to history.</p>
			{/if}
			<HistoryTrend points={trend} />
		</section>
	{/if}

	<div class="meta">
		<p>Ratings as of {updateDate}</p>
		<p>
			{count(selected.total)} active {division ? `${division} ` : ''}players{place
				? ` in ${placeName}`
				: ''} whose rating changed in the last {data.month.active_window_months} months
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

	.phrase {
		white-space: nowrap;
	}

	/* Phones: give the card's text more width instead of shrinking it. */
	@media (max-width: 30rem) {
		main {
			padding-inline: var(--size-2);
		}

		.card {
			padding-inline: var(--size-3);
		}
	}

	.history {
		gap: var(--size-3);
	}

	h2 {
		max-inline-size: none;
		font-size: var(--font-size-3);
		color: var(--text-1);
	}

	h2 span {
		font-weight: var(--font-weight-4);
		color: var(--text-2);
	}

	.note {
		font-size: var(--font-size-0);
		color: var(--text-2);
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
