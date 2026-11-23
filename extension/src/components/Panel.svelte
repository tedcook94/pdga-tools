<script lang="ts">
	import { formatChange, formatDate, newEvent } from '@/lib/editing';
	import { parseEventId } from '@/lib/event-page';
	import { fetchEvent } from '@/lib/fetch-event';
	import { importEvent } from '@/lib/import';
	import type { AddedEvent, EventKind } from '@/lib/events';
	import { project } from '@/lib/projection';
	import type { RatingsPage } from '@/lib/ratings-page';
	import type { LoadResult, SaveResult } from '@/lib/storage';
	import EventEditor from './EventEditor.svelte';
	import Timeline from './Timeline.svelte';

	interface Props {
		page: RatingsPage;
		/** PDGA number of the player whose ratings page this is. */
		player: string;
		/** Saved events to start from. */
		initialEvents: AddedEvent[];
		initialCollapsed?: boolean;
		/** The saved events are only on this device because sync failed. */
		initialLocalOnly?: boolean;
		onchange: (events: AddedEvent[]) => void | Promise<SaveResult>;
		oncollapse?: (collapsed: boolean) => void;
		/** Subscribes to changes made in other tabs or devices; returns an unsubscribe. */
		watch?: (onchange: (result: LoadResult) => void) => () => void;
		/** Loads event pages for imports; replaced in tests. */
		fetcher?: typeof fetch;
	}

	let {
		page,
		player,
		initialEvents,
		initialCollapsed = false,
		initialLocalOnly = false,
		onchange,
		oncollapse,
		watch,
		fetcher
	}: Props = $props();

	// The panel owns its state from here on; later prop changes are ignored.
	// svelte-ignore state_referenced_locally
	let events = $state(initialEvents);
	// svelte-ignore state_referenced_locally
	let collapsed = $state(initialCollapsed);
	// svelte-ignore state_referenced_locally
	let localOnly = $state(initialLocalOnly);

	const projection = $derived(project(page, events));
	const next = $derived(projection.updates[0]);
	const problems = $derived(
		new Map(projection.invalid.map(({ event, problems }) => [event.id, problems]))
	);
	const counted = $derived(new Set(projection.counted.map((event) => event.id)));

	// What storage already holds, so loaded or watched events aren't written back.
	// svelte-ignore state_referenced_locally
	let stored = JSON.stringify(initialEvents);
	$effect(() => {
		const snapshot = $state.snapshot(events);
		const json = JSON.stringify(snapshot);
		if (json === stored) return;
		stored = json;
		void save(snapshot);
	});

	$effect(() =>
		watch?.((result) => {
			stored = JSON.stringify(result.events);
			events = result.events;
			localOnly = result.localOnly;
		})
	);

	async function save(snapshot: AddedEvent[]) {
		const result = await onchange(snapshot);
		if (result) localOnly = result.localOnly;
	}

	function toggle() {
		collapsed = !collapsed;
		oncollapse?.(collapsed);
	}

	function add(kind: EventKind) {
		events.push(newEvent(kind));
	}

	function remove(id: string) {
		events = events.filter((event) => event.id !== id);
	}

	let importText = $state('');
	let importing = $state(false);
	let importMessage = $state<{ text: string; error: boolean } | null>(null);

	/** Imports or refreshes one event. Returns an error message, or null when it worked. */
	async function runImport(pdgaEventId: number): Promise<string | null> {
		if (page.rounds.some((round) => round.eventId === pdgaEventId)) {
			return 'This event is already in your current rating.';
		}
		const result = await fetchEvent(pdgaEventId, player, fetcher);
		if (!result.ok) return result.error;
		events = importEvent(
			$state.snapshot(events),
			player,
			pdgaEventId,
			result.page,
			result.rounds
		);
		return null;
	}

	async function submitImport(e: SubmitEvent) {
		e.preventDefault();
		const pdgaEventId = parseEventId(importText);
		if (pdgaEventId === null) {
			importMessage = {
				text: 'Enter an event ID, event page link or PDGA Live link.',
				error: true
			};
			return;
		}
		const existed = events.some((event) => event.pdgaEventId === pdgaEventId);
		importing = true;
		importMessage = null;
		const error = await runImport(pdgaEventId);
		importing = false;
		if (error) {
			importMessage = { text: error, error: true };
			return;
		}
		importText = '';
		const event = events.find((candidate) => candidate.pdgaEventId === pdgaEventId)!;
		const count = event.rounds.length;
		const rounds = count === 1 ? '1 rated round' : `${count} rated rounds`;
		importMessage = {
			text: `${existed ? 'Updated' : 'Imported'} ${event.name}: ${rounds}.`,
			error: false
		};
	}

	function clearCounted() {
		events = events.filter((event) => !counted.has(event.id));
	}
</script>

<section class="panel">
	<header>
		<button class="toggle" type="button" aria-expanded={!collapsed} onclick={toggle}>
			<span class="chevron" aria-hidden="true">▾</span>
			<h2>Rating projection</h2>
		</button>
		<span class="estimate" title="Recreates PDGA's published method; may differ by a point"
			>estimate</span
		>
		{#if localOnly}
			<span
				class="local-only"
				title="Browser sync is full or unavailable, so these rounds won't reach your other devices."
				>Saved on this device only</span
			>
		{/if}
		{#if collapsed && next}
			<span class="summary">
				{formatDate(next.update.date)} · <strong>{next.rating}</strong>
				{formatChange(next.change)}
			</span>
		{/if}
	</header>

	{#if !collapsed}
		<div class="body">
			{#if projection.updates.length > 0}
				<Timeline updates={projection.updates} />
			{:else if events.length === 0}
				<p class="empty">
					Import or add the tournaments and leagues you've played since your last update to
					see your next rating.
				</p>
			{:else}
				<p class="empty">Finish the rounds below to see your next rating.</p>
			{/if}

			<form class="import" onsubmit={submitImport}>
				<label for="import-event">Import from event</label>
				<div class="import-row">
					<input
						id="import-event"
						placeholder="Event ID, event page link or PDGA Live link"
						autocomplete="off"
						bind:value={importText}
					/>
					<button type="submit" disabled={importing}>
						{importing ? 'Importing…' : 'Import'}
					</button>
				</div>
				{#if importMessage}
					<p class="import-message" class:error={importMessage.error} role="status">
						{importMessage.text}
					</p>
				{/if}
			</form>
			{#each events as event, index (event.id)}
				{@const pdgaEventId = event.pdgaEventId}
				<EventEditor
					bind:event={events[index]!}
					problems={problems.get(event.id) ?? []}
					counted={counted.has(event.id)}
					onremove={() => remove(event.id)}
					onrefresh={pdgaEventId === undefined ? undefined : () => runImport(pdgaEventId)}
				/>
			{/each}

			<div class="actions">
				<button type="button" onclick={() => add('tournament')}>+ Tournament</button>
				<button type="button" onclick={() => add('league')}>+ League</button>
				{#if counted.size > 0}
					<button type="button" class="clear" onclick={clearCounted}>
						Clear counted ({counted.size})
					</button>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.panel {
		margin: 16px 0;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-top: 3px solid var(--accent);
		border-radius: 8px;
		background: #fff;
		color: var(--text);
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		font-size: 14px;
		line-height: 1.4;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}

	.toggle {
		display: flex;
		gap: 6px;
		align-items: center;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		cursor: pointer;
	}

	.chevron {
		display: inline-block;
		transition: transform 0.15s;
	}

	[aria-expanded='false'] .chevron {
		transform: rotate(-90deg);
	}

	h2 {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
	}

	.estimate {
		padding: 1px 8px;
		border-radius: 999px;
		background: #fff4d6;
		color: #7a5a00;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.local-only {
		font-size: 12px;
		color: var(--danger);
	}

	.summary {
		margin-left: auto;
		color: var(--muted);
	}

	.summary strong {
		color: var(--accent);
	}

	.body {
		display: grid;
		gap: 16px;
		margin-top: 14px;
	}

	.empty {
		margin: 0;
		color: var(--muted);
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.import {
		display: grid;
		gap: 6px;
	}

	.import label {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.import-row {
		display: flex;
		gap: 8px;
		max-width: 36rem;
	}

	.import-row input {
		flex: 1;
	}

	.import-message {
		margin: 0;
		font-size: 13px;
		color: var(--up);
	}

	.import-message.error {
		color: var(--danger);
	}

	.actions .clear {
		margin-left: auto;
		color: var(--muted);
	}
</style>
