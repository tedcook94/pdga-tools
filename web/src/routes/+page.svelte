<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>PDGA Tools</title>
</svelte:head>

<main>
	<header>
		<h1>Pick a tool</h1>
		<p class="lead">Small tools built on PDGA data</p>
	</header>

	<ul>
		<li>
			<a class="card" href={resolve('/percentile')}>
				<span class="icon" aria-hidden="true">
					<svg
						viewBox="0 0 32 32"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M3 26h26" />
						<path d="M4 25c5 0 6-16 12-16s7 16 12 16" />
						<path d="M19 8v18" stroke-dasharray="2 2.5" />
					</svg>
				</span>
				<span class="text">
					<h2>Rating Percentile</h2>
					<p>Compare your rating to other active players</p>
				</span>
			</a>
		</li>
	</ul>
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
		color: var(--text-2);
	}

	.lead {
		margin-inline: auto;
	}

	ul {
		inline-size: 100%;
		max-inline-size: 32rem;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--size-4);
	}

	/* Open Props caps li width at --size-content-2, which pushed the card off center. */
	li {
		max-inline-size: none;
		padding: 0;
	}

	a.card {
		grid-template-columns: auto 1fr;
		gap: var(--size-4);
		align-items: center;
		text-align: start;
		color: inherit;
		text-decoration: none;
		transition: border-color 0.2s var(--ease-3), translate 0.2s var(--ease-3);
	}

	a.card:hover,
	a.card:focus-visible {
		border-color: var(--accent);
		translate: 0 calc(var(--size-1) * -1);
	}

	.icon {
		display: grid;
		place-items: center;
		inline-size: var(--size-9);
		block-size: var(--size-9);
		border-radius: var(--radius-3);
		color: white;
		background: linear-gradient(135deg, var(--accent), var(--accent-2));
	}

	@media (prefers-color-scheme: dark) {
		.icon {
			color: var(--surface-1);
		}
	}

	.icon svg {
		inline-size: 65%;
	}

	.text {
		display: grid;
		gap: var(--size-1);
	}

	/* The global balanced wrap broke this line early, leaving a gap on the right. */
	.text p {
		font-size: var(--font-size-1);
		text-wrap: wrap;
	}

	h2 {
		max-inline-size: none;
		font-size: var(--font-size-4);
		color: var(--accent);
	}
</style>
