<script lang="ts">
	import '../app.css';
	import { resolve } from '$app/paths';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="topbar">
	<div class="topbar-inner">
		<a class="wordmark" href={resolve('/')}>PDGA Tools</a>
	</div>
</div>

{@render children()}

<footer>
	<p>
		Player, event, and course data provided by <a href="https://www.pdga.com">PDGA</a>.
	</p>
</footer>

<style>
	.topbar {
		position: sticky;
		inset-block-start: 0;
		z-index: 1;
		border-block-end: var(--border-size-1) solid var(--card-border);
		background: var(--card-bg);
		backdrop-filter: blur(12px);
	}

	.topbar-inner {
		padding: var(--size-3) var(--size-5);
	}

	.wordmark {
		font-size: var(--font-size-3);
		font-weight: var(--font-weight-8);
		text-decoration: none;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
		background-clip: text;
		color: transparent;
	}

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
