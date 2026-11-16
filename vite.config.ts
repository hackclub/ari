import { sentrySvelteKit } from '@sentry/sveltekit';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			errorHandler: (err) => console.warn('[sentry] release/source-map upload failed:', err),
			// wrapping universal loads would put the whole client sdk back in the first page load
			autoInstrument: { load: false }
		}),
		tailwindcss(),
		sveltekit()
	],
	// the private module is loaded on demand in places: the dev server only serves a
	// dynamic import from a folder it was told about
	server: { fs: { allow: ['private'] } },
	build: {
		minify: 'oxc'
	}
});
