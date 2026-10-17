<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<footer>
	<p>
		Player, event, and course data provided by <a href="https://www.pdga.com">PDGA</a>.
	</p>
</footer>

<style>
	footer {
		padding: var(--size-6) var(--size-4);
		display: grid;
		gap: var(--size-1);
		justify-items: center;
		text-align: center;
		font-size: var(--font-size-0);
		color: var(--text-2);
	}
</style>
