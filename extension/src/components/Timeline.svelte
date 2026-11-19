<script lang="ts">
	import { formatChange, formatDate, roundLabel } from '@/lib/editing';
	import type { CalcRound, ProjectedUpdate } from '@/lib/projection';

	interface Props {
		updates: ProjectedUpdate[];
	}

	let { updates }: Props = $props();

	function sections(update: ProjectedUpdate) {
		return [
			{ title: 'Added', rounds: update.added, open: true },
			{ title: 'Dropped as outliers', rounds: update.result.dropped, open: true },
			{ title: 'Aged out', rounds: update.agedOut, open: true },
			// Up to a quarter of all rounds, so collapsed to keep the card short.
			{ title: 'Counted twice', rounds: update.result.doubled, open: false }
		].filter((section) => section.rounds.length > 0);
	}
</script>

{#snippet roundList(rounds: CalcRound[])}
	<ul class="chips">
		{#each rounds as round, index (index)}
			<li class:added={round.source === 'added'}>
				{roundLabel(round)} <strong>{round.rating}</strong>
			</li>
		{/each}
	</ul>
{/snippet}

<ol class="timeline">
	{#each updates as update (update.update.date)}
		<li class="update">
			<header>
				<div class="when">
					<span class="date">{formatDate(update.update.date)}</span>
					<span class="cutoff">rounds through {formatDate(update.update.cutoff)}</span>
				</div>
				<span class="rating">{update.rating}</span>
				<span class="change" class:up={update.change > 0} class:down={update.change < 0}
					>{formatChange(update.change)}</span
				>
			</header>
			{#each sections(update) as section (section.title)}
				<details open={section.open}>
					<summary>{section.title} <span class="count">{section.rounds.length}</span></summary>
					{@render roundList(section.rounds)}
				</details>
			{/each}
		</li>
	{/each}
</ol>

<style>
	.timeline {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 10px;
	}

	.update {
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	header {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	.when {
		display: grid;
		margin-right: auto;
	}

	.date {
		font-weight: 600;
	}

	.cutoff {
		font-size: 12px;
		color: var(--muted);
	}

	.rating {
		font-size: 26px;
		font-weight: 700;
		line-height: 1;
		color: var(--accent);
	}

	.change {
		min-width: 2.5rem;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font-size: 13px;
		font-weight: 600;
		text-align: center;
	}

	.up {
		background: var(--up-soft);
		color: var(--up);
	}

	.down {
		background: var(--danger-soft);
		color: var(--danger);
	}

	details {
		margin-top: 10px;
	}

	summary {
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.count {
		font-weight: 400;
	}

	.chips {
		margin: 6px 0 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.chips li {
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface);
		font-size: 13px;
	}

	.chips li.added {
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
