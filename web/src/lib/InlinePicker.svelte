<script lang="ts">
	export interface PickerOption {
		value: string;
		label: string;
		ariaLabel?: string;
	}

	export interface PickerGroup {
		label: string;
		options: PickerOption[];
	}

	interface Props {
		value: string;
		/** Text shown inline for the selected value. */
		display: string;
		ariaLabel: string;
		/** Ungrouped options listed before the groups, e.g. "all". */
		top: PickerOption[];
		groups: PickerGroup[];
	}

	let { value = $bindable(), display, ariaLabel, top, groups }: Props = $props();
</script>

<span class="picker">
	<span class="picker-text" aria-hidden="true">
		{display}
		<svg viewBox="0 0 12 12"><path d="M3 4.5l3 3 3-3" /></svg>
	</span>
	<!-- Transparent select stretched over the visible text, so clicks anywhere
	     on the text or chevron open the native list. -->
	<select bind:value aria-label={ariaLabel}>
		{#each top as option (option.value)}
			<option value={option.value} aria-label={option.ariaLabel}>{option.label}</option>
		{/each}
		{#each groups as group (group.label)}
			<optgroup label={group.label}>
				{#each group.options as option (option.value)}
					<option value={option.value} aria-label={option.ariaLabel}>{option.label}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
</span>

<style>
	.picker {
		position: relative;
		display: inline-flex;
		align-items: center;
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

	svg {
		inline-size: 0.75em;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		pointer-events: none;
	}
</style>
