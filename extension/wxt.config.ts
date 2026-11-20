import { defineConfig } from 'wxt';

export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	manifestVersion: 3,
	zip: { name: 'rating-projector' },
	manifest: ({ browser }) => ({
		name: 'Rating Projector for PDGA',
		description:
			'Projects your next PDGA rating updates from rounds you add, right on your ratings detail page.',
		permissions: ['storage'],
		...(browser === 'firefox' && {
			browser_specific_settings: {
				gecko: {
					id: 'rating-projector@pdga-tools',
					// Firefox requires new extensions to declare data collection; this one collects nothing.
					data_collection_permissions: { required: ['none'] }
				}
			}
		})
	})
});
