<script lang="ts">
	import { asset } from '$app/paths';
	import TrendIcon from '#lib/TrendIcon.svelte';

	// A null url shows "coming soon" instead of linking nowhere.
	const stores: { name: string; url: string | null }[] = [
		{
			name: 'Chrome',
			url: 'https://chromewebstore.google.com/detail/rating-projector-for-pdga/cjciholkdnnklckjmkmkfoepeolbclnm'
		},
		{
			name: 'Firefox',
			url: 'https://addons.mozilla.org/firefox/addon/rating-projector-for-pdga/'
		}
	];

	// Store copies of this and two more, padded to 1280×800, are in extension/store/.
	const screenshot = asset('rating/expanded.png');
</script>

<svelte:head>
	<title>Rating Projector for PDGA · PDGA Tools</title>
	<meta
		name="description"
		content="A browser extension that projects your next PDGA rating updates from rounds you add, right on your ratings detail page."
	/>
</svelte:head>

<main>
	<header>
		<span class="mark"><TrendIcon /></span>
		<h1>Rating Projector for PDGA</h1>
		<p class="lead">
			See your next PDGA ratings before they're published, right on your ratings detail page.
		</p>
	</header>

	<div class="stores">
		{#each stores as store (store.name)}
			{#if store.url}
				<a class="store" href={store.url} rel="external">Get it for {store.name}</a>
			{:else}
				<span class="store soon">{store.name}: coming soon</span>
			{/if}
		{/each}
	</div>

	<a class="screenshot" href={screenshot}>
		<img
			src={screenshot}
			alt="The panel on a ratings detail page: the next update with added, dropped and aged-out rounds, above a tournament with three rounds."
			width="1280"
			height="636"
		/>
	</a>

	<section class="card">
		<h2>What it does</h2>
		<ul>
			<li>
				<strong>Import an event from its ID or link,</strong> including PDGA Live links, or with
				one click on its event page. Refresh it as more league weeks are rated.
			</li>
			<li>
				<strong>Or add tournaments and leagues by hand,</strong> then add, renumber or delete
				rounds under them as you play.
			</li>
			<li>
				<strong>See every upcoming update:</strong> the projected rating and change, which
				rounds get added, dropped as outliers, counted twice or aged out.
			</li>
			<li>
				<strong>Leagues land when they end.</strong> Each league's rounds count in the update
				after its end date, like PDGA reports them.
			</li>
			<li>
				<strong>Events already in your rating are greyed out,</strong> with one click to clear them.
			</li>
		</ul>
	</section>

	<section class="card">
		<h2>How to use it</h2>
		<ol>
			<li>Install the extension for Chrome or Firefox.</li>
			<li>
				On pdga.com, open your player page and choose <strong>Ratings Detail</strong>.
			</li>
			<li>
				Import the events you've played since the last update, or add them with each round's
				rating.
			</li>
		</ol>
		<p class="note">
			Projections are estimates based on PDGA's published method and can be off by a point or
			so.
		</p>
	</section>
</main>

<style>
	/* Wider than other pages: the panel is only the middle of each screenshot
	   and is unreadable at 48rem. Text sections cap their own width. */
	main {
		inline-size: 100%;
		max-inline-size: 72rem;
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
		justify-items: center;
	}

	.mark {
		display: grid;
		place-items: center;
		inline-size: var(--size-10);
		block-size: var(--size-10);
		border-radius: var(--radius-4);
		color: white;
		background: linear-gradient(135deg, var(--accent), var(--accent-2));
	}

	@media (prefers-color-scheme: dark) {
		.mark {
			color: var(--surface-1);
		}
	}

	.mark :global(svg) {
		inline-size: 75%;
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
		max-inline-size: 32rem;
		color: var(--text-2);
	}

	.stores {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-3);
		justify-content: center;
	}

	.store {
		padding: var(--size-2) var(--size-5);
		border-radius: var(--radius-round);
		font-weight: var(--font-weight-6);
		text-decoration: none;
		color: white;
		background: linear-gradient(90deg, var(--accent), var(--accent-2));
	}

	@media (prefers-color-scheme: dark) {
		.store {
			color: var(--surface-1);
		}
	}

	.store.soon {
		border: var(--border-size-1) solid var(--card-border);
		color: var(--text-2);
		background: var(--card-bg);
	}

	.screenshot {
		inline-size: 100%;
	}

	.screenshot img {
		display: block;
		inline-size: 100%;
		block-size: auto;
		border-radius: var(--radius-3);
		box-shadow: var(--card-shadow);
	}

	.card {
		inline-size: 100%;
		max-inline-size: 36rem;
		text-align: start;
	}

	h2 {
		max-inline-size: none;
		font-size: var(--font-size-4);
		color: var(--accent);
	}

	ul,
	ol {
		display: grid;
		gap: var(--size-2);
		padding-inline-start: var(--size-5);
	}

	li {
		max-inline-size: none;
		padding-inline-start: var(--size-1);
	}

	.note {
		font-size: var(--font-size-1);
		text-wrap: pretty;
		color: var(--text-2);
	}
</style>
