import { defineConfig } from 'wxt';

export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	manifestVersion: 3,
	zip: {
		name: 'rating-projector',
		// Firefox reviewers only need what builds the extension.
		excludeSources: ['store/**', 'fixtures/**', 'scripts/**', 'src/**/*.test-helper.ts']
	},
	manifest: ({ browser }) => ({
		name: 'Rating Projector for PDGA',
		description:
			"See your next PDGA ratings before they're published, from events you import or add, right on your Ratings Detail page.",
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
