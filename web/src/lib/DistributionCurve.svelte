<script lang="ts">
	import { areaPath, buildCurve, clampRating, linePath } from '#lib/curve.ts';

	interface Props {
		ratings: Record<string, number>;
		rating: number | null;
		valid: boolean;
	}

	let { ratings, rating = $bindable(), valid }: Props = $props();

	const HEIGHT = 140;
	const AXIS = 24;
	const TOP = 12;

	let width = $state(0);
	let dragging = $state(false);

	const curve = $derived(buildCurve(ratings));
	const plotHeight = HEIGHT - AXIS - TOP;
	const line = $derived(curve && width ? linePath(curve, width, plotHeight) : '');
	const area = $derived(curve && width ? areaPath(curve, width, plotHeight) : '');

	const ticks = $derived.by(() => {
		if (!curve) return [];
		const out = [];
		for (let t = Math.ceil(curve.min / 200) * 200; t <= curve.max; t += 200) out.push(t);
		return out;
	});

	const FADE_RATINGS = 200;

	const xOf = (r: number) =>
		curve ? ((r - curve.min) / (curve.max - curve.min || 1)) * width : 0;

	const markerX = $derived(curve && rating != null && valid ? xOf(clampRating(curve, rating)) : null);

	const fadeToX = $derived(curve ? Math.min(xOf(curve.peakRating), markerX ?? 0) : 0);
	const fadeFromX = $derived(
		curve ? fadeToX - (FADE_RATINGS / (curve.max - curve.min || 1)) * width : 0
	);

	const markerY = $derived.by(() => {
		if (!curve || markerX == null || rating == null) return plotHeight;
		const point = curve.points[clampRating(curve, rating) - curve.min];
		return plotHeight - (point.count / (curve.peak || 1)) * plotHeight;
	});

	function setFromPointer(event: PointerEvent) {
		if (!curve || !width) return;
		const box = (event.currentTarget as SVGElement).getBoundingClientRect();
		const ratio = (event.clientX - box.left) / box.width;
		rating = clampRating(curve, curve.min + ratio * (curve.max - curve.min));
	}

	function onPointerDown(event: PointerEvent) {
		dragging = true;
		(event.currentTarget as SVGElement).setPointerCapture(event.pointerId);
		setFromPointer(event);
	}

	function onPointerMove(event: PointerEvent) {
		if (dragging) setFromPointer(event);
	}

	function onPointerUp() {
		dragging = false;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (!curve) return;
		const steps: Record<string, number> = {
			ArrowLeft: -1,
			ArrowDown: -1,
			ArrowRight: 1,
			ArrowUp: 1,
			PageDown: -10,
			PageUp: 10
		};
		let next: number | undefined;
		if (event.key in steps) next = (valid && rating != null ? rating : 900) + steps[event.key];
		else if (event.key === 'Home') next = curve.min;
		else if (event.key === 'End') next = curve.max;
		if (next === undefined) return;
		event.preventDefault();
		rating = clampRating(curve, next);
	}
</script>

{#if curve}
	<div class="curve" bind:clientWidth={width}>
		<svg
			role="slider"
			tabindex="0"
			aria-label="Rating"
			aria-valuemin={curve.min}
			aria-valuemax={curve.max}
			aria-valuenow={valid && rating != null ? rating : undefined}
			width={width}
			height={HEIGHT}
			class:dragging
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			onkeydown={onKeyDown}
		>
			<defs>
				<linearGradient id="curve-fill" x1="0" x2="1">
					<stop offset="0" stop-color="var(--accent)" stop-opacity="0.9" />
					<stop offset="1" stop-color="var(--accent-2)" stop-opacity="0.9" />
				</linearGradient>
				<!-- Full strength from the peak (or the marker, if it's left of the peak) and a
				     fixed fade to the left of that, so the bulk of players stays bright. -->
				<linearGradient
					id="curve-fade"
					gradientUnits="userSpaceOnUse"
					x1={fadeFromX}
					x2={fadeToX}
				>
					<stop offset="0" stop-color="white" stop-opacity="0.1" />
					<stop offset="1" stop-color="white" stop-opacity="1" />
				</linearGradient>
				<mask id="curve-fade-mask">
					<rect width={width} height={HEIGHT} fill="url(#curve-fade)" />
				</mask>
				<clipPath id="curve-left">
					<rect
						class="slide"
						width={width}
						height={HEIGHT}
						style:transform="translateX({(markerX ?? 0) - width}px)"
					/>
				</clipPath>
			</defs>

			<g transform="translate(0 {TOP})">
				<path class="area" d={area} />
				{#if markerX != null}
					<g clip-path="url(#curve-left)">
						<path d={area} fill="url(#curve-fill)" mask="url(#curve-fade-mask)" />
					</g>
				{/if}
				<path class="line" d={line} />

				{#if markerX != null}
					<g class="slide" style:transform="translateX({markerX}px)">
						<!-- Scaled rather than moving y1, because CSS can animate transforms but not line endpoints. -->
						<line
							class="marker"
							y1="0"
							y2={plotHeight}
							style:transform="scaleY({(plotHeight - markerY) / plotHeight})"
						/>
						<circle class="handle" cy={markerY} r="7" />
					</g>
				{/if}

				{#each ticks as tick (tick)}
					<text class="tick" x={xOf(tick)} y={plotHeight + 18}>{tick}</text>
				{/each}
			</g>
		</svg>
	</div>
{/if}

<style>
	.curve {
		inline-size: 100%;
	}

	svg {
		display: block;
		overflow: visible;
		cursor: ew-resize;
		/* Horizontal drags set the rating; vertical swipes still scroll the page. */
		touch-action: pan-y;
		border-radius: var(--radius-2);
	}

	svg:focus-visible {
		outline: var(--border-size-2) solid var(--accent);
		outline-offset: var(--size-2);
	}

	.area {
		fill: var(--track);
	}

	.line {
		fill: none;
		stroke: color-mix(in oklab, var(--accent) 60%, transparent);
		stroke-width: 1.5;
	}

	.slide {
		transition: transform 0.4s var(--ease-out-3);
	}

	.dragging .slide,
	.dragging .marker {
		transition: none;
	}

	.marker {
		stroke: var(--accent-2);
		stroke-width: 2;
		transform-box: fill-box;
		transform-origin: bottom;
		transition: transform 0.4s var(--ease-out-3);
	}

	.handle {
		fill: var(--surface-1);
		stroke: var(--accent-2);
		stroke-width: 3;
		cursor: grab;
		transition: cy 0.4s var(--ease-out-3);
	}

	.dragging .handle {
		transition: none;
	}

	.dragging .handle {
		cursor: grabbing;
	}

	.tick {
		font-size: var(--font-size-00);
		fill: var(--text-2);
		text-anchor: middle;
	}
</style>
