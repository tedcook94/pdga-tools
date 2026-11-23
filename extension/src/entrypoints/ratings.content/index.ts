import './style.css';
import { mount, unmount } from 'svelte';
import Panel from '@/components/Panel.svelte';
import { parseRatingsPage } from '@/lib/ratings-page';
import { eventStore, loadCollapsed, pdgaNumber, saveCollapsed } from '@/lib/storage';

export default defineContentScript({
	matches: ['https://www.pdga.com/player/*/details'],
	cssInjectionMode: 'ui',

	async main(ctx) {
		const table = document.querySelector('#player-results-details');
		const player = pdgaNumber(location.pathname);
		if (!table || !player) return;

		const page = parseRatingsPage(document);
		const store = eventStore(player);
		const [saved, initialCollapsed] = await Promise.all([store.load(), loadCollapsed()]);

		const ui = await createShadowRootUi(ctx, {
			name: 'rating-projector',
			position: 'inline',
			anchor: table.closest('.table-container') ?? table,
			append: 'before',
			onMount: (container) =>
				mount(Panel, {
					target: container,
					props: {
						page,
						player,
						initialEvents: saved.events,
						initialCollapsed,
						initialLocalOnly: saved.localOnly,
						onchange: store.save,
						watch: store.watch,
						oncollapse: (collapsed) => void saveCollapsed(collapsed)
					}
				}),
			onRemove: (panel) => {
				if (panel) unmount(panel);
			}
		});
		ui.mount();
	}
});
