import './style.css';
import { mount, unmount } from 'svelte';
import Panel from '@/components/Panel.svelte';

export default defineContentScript({
	matches: ['https://www.pdga.com/player/*/details'],
	cssInjectionMode: 'ui',

	async main(ctx) {
		const table = document.querySelector('#player-results-details');
		if (!table) return;

		const ui = await createShadowRootUi(ctx, {
			name: 'rating-projector',
			position: 'inline',
			anchor: table.closest('.table-container') ?? table,
			append: 'before',
			onMount: (container) => mount(Panel, { target: container }),
			onRemove: (panel) => {
				if (panel) unmount(panel);
			}
		});
		ui.mount();
	}
});
