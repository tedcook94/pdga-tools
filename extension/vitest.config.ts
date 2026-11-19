import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
	plugins: [WxtVitest()],
	test: {
		// Tests arrive with the parser in the next commit.
		passWithNoTests: true
	}
});
