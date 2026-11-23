<script lang="ts">
	import { formatChange, formatDate, newEvent } from '@/lib/editing';
	import type { AddedEvent, EventKind } from '@/lib/events';
	import { project } from '@/lib/projection';
	import type { RatingsPage } from '@/lib/ratings-page';
	import type { LoadResult, SaveResult } from '@/lib/storage';
	import EventEditor from './EventEditor.svelte';
	import Timeline from './Timeline.svelte';

	interface Props {
		page: RatingsPage;
		/** Saved events to start from. */
		initialEvents: AddedEvent[];
		initialCollapsed?: boolean;
		/** The saved events are only on this device because sync failed. */
		initialLocalOnly?: boolean;
		onchange: (events: AddedEvent[]) => void | Promise<SaveResult>;
		oncollapse?: (collapsed: boolean) => void;
		/** Subscribes to changes made in other tabs or devices; returns an unsubscribe. */
		watch?: (onchange: (result: LoadResult) => void) => () => void;
	}

	let {
		page,
		initialEvents,
		initialCollapsed = false,
		initialLocalOnly = false,
		onchange,
		oncollapse,
		watch
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
					Add a tournament or league you've played since your last update to see your next
					rating.
				</p>
			{:else}
				<p class="empty">Finish the rounds below to see your next rating.</p>
			{/if}

			{#each events as event, index (event.id)}
				<EventEditor
					bind:event={events[index]!}
					problems={problems.get(event.id) ?? []}
					counted={counted.has(event.id)}
					onremove={() => remove(event.id)}
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

	.actions .clear {
		margin-left: auto;
		color: var(--muted);
	}
</style>
