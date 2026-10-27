<script lang="ts">
	import type { HistoryPoint } from '#lib/history.ts';
	import { ordinal } from '#lib/percentile.ts';

	interface Props {
		points: HistoryPoint[];
	}

	let { points }: Props = $props();

	const HEIGHT = 160;
	const TOP = 12;
	const AXIS = 24;
	const LEFT = 32;
	const plotHeight = HEIGHT - TOP - AXIS;

	let width = $state(0);
	let active = $state<number | null>(null);

	const plotWidth = $derived(Math.max(0, width - LEFT - 8));
	const first = $derived(points[0]?.year ?? 0);
	const last = $derived(points.at(-1)?.year ?? 0);

	const xOf = (year: number) => LEFT + ((year - first) / (last - first || 1)) * plotWidth;
	const yOf = (p: number) => TOP + (1 - p / 100) * plotHeight;

	const path = $derived(
		points.map((p, i) => `${i ? 'L' : 'M'}${xOf(p.year).toFixed(1)},${yOf(p.percentile).toFixed(1)}`).join('')
	);
	const area = $derived(
		points.length
			? `${path}L${xOf(last).toFixed(1)},${TOP + plotHeight}L${xOf(first).toFixed(1)},${TOP + plotHeight}Z`
			: ''
	);

	const yearTicks = $derived.by(() => {
		const step = plotWidth < 320 ? 10 : 5;
		const ticks = [];
		for (let y = Math.ceil(first / step) * step; y <= last; y += step) ticks.push(y);
		return ticks;
	});

	// The picked year stays until another is picked, so a past year can be
	// read without holding the pointer still. A new rating resets to latest.
	$effect(() => {
		void points;
		active = null;
	});

	// Defaults to the latest year so the readout is never empty.
	const shown = $derived(points.find((p) => p.year === active) ?? points.at(-1));

	function nearest(event: PointerEvent) {
		if (!points.length || !plotWidth) return;
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const ratio = (event.clientX - box.left - LEFT) / plotWidth;
		const year = Math.round(first + ratio * (last - first));
		active = Math.min(last, Math.max(first, year));
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!shown) return;
		let year: number | undefined;
		if (event.key === 'ArrowLeft') year = shown.year - 1;
		else if (event.key === 'ArrowRight') year = shown.year + 1;
		else if (event.key === 'Home') year = first;
		else if (event.key === 'End') year = last;
		if (year === undefined) return;
		event.preventDefault();
		active = Math.min(last, Math.max(first, year));
	}

	const count = (n: number) => n.toLocaleString('en-US');
</script>

<div class="trend" bind:clientWidth={width}>
	{#if shown}
		<p class="readout" aria-live="polite">
			<strong>{shown.percentile.toFixed(1)}<span class="suffix">{ordinal(shown.percentile)}</span></strong>
			in {shown.year}
			<span class="players">of {count(shown.total)} players</span>
		</p>
	{/if}

	<svg
		width={width}
		height={HEIGHT}
		role="slider"
		tabindex="0"
		aria-label="Year"
		aria-valuemin={first}
		aria-valuemax={last}
		aria-valuenow={shown?.year}
		onpointermove={nearest}
		onpointerdown={nearest}
		onkeydown={onKeyDown}
	>
		<defs>
			<linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
				<stop offset="0" stop-color="var(--accent)" stop-opacity="0.45" />
				<stop offset="1" stop-color="var(--accent-2)" stop-opacity="0.05" />
			</linearGradient>
		</defs>

		{#each [0, 50, 100] as p (p)}
			<line class="grid" x1={LEFT} x2={LEFT + plotWidth} y1={yOf(p)} y2={yOf(p)} />
			<text class="tick y" x={LEFT - 6} y={yOf(p) + 4}>{p}</text>
		{/each}

		<path d={area} fill="url(#trend-fill)" />
		<path class="line" d={path} />

		{#if shown}
			<line class="cursor" x1={xOf(shown.year)} x2={xOf(shown.year)} y1={TOP} y2={TOP + plotHeight} />
			<circle class="dot" cx={xOf(shown.year)} cy={yOf(shown.percentile)} r="5" />
		{/if}

		{#each yearTicks as year (year)}
			<text class="tick" x={xOf(year)} y={TOP + plotHeight + 18}>{year}</text>
		{/each}
	</svg>
</div>

<style>
	.trend {
		inline-size: 100%;
		display: grid;
		gap: var(--size-2);
	}

	.readout {
		color: var(--text-2);
	}

	strong {
		font-size: var(--font-size-4);
		font-weight: var(--font-weight-8);
		font-variant-numeric: tabular-nums;
		color: var(--accent);
	}

	.suffix {
		font-size: 0.55em;
		vertical-align: super;
	}

	.players {
		font-size: var(--font-size-0);
	}

	svg {
		display: block;
		overflow: visible;
		cursor: crosshair;
		touch-action: pan-y;
		border-radius: var(--radius-2);
	}

	svg:focus-visible {
		outline: var(--border-size-2) solid var(--accent);
		outline-offset: var(--size-2);
	}

	.grid {
		stroke: var(--track);
		stroke-dasharray: 2 4;
	}

	.line {
		fill: none;
		stroke: var(--accent);
		stroke-width: 2;
		stroke-linejoin: round;
	}

	.cursor {
		stroke: color-mix(in oklab, var(--accent-2) 50%, transparent);
	}

	.dot {
		fill: var(--surface-1);
		stroke: var(--accent-2);
		stroke-width: 3;
	}

	.tick {
		font-size: var(--font-size-00);
		fill: var(--text-2);
		text-anchor: middle;
	}

	.tick.y {
		text-anchor: end;
	}
</style>
