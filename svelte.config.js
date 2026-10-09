import { existsSync } from 'node:fs';
import adapter from '@sveltejs/adapter-node';

// setting ARI_PUBLIC_BUILD=1 builds against the stub even when the private checkout is present
const privateDir =
	process.env.ARI_PUBLIC_BUILD !== '1' && existsSync('private/web/index.ts')
		? 'private/web'
		: 'src/lib/privateStub';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// force runes mode except for libraries. can be removed in svelte 6
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter(),
		alias: {
			$private: privateDir,
			'$private/*': `${privateDir}/*`,
			$db: 'generated/prisma/client'
		},
		// sveltekit's origin check rejects no-origin posts like /oauth/token, so it is off here
		// and re-applied for the cookie surface in hooks.server.ts
		csrf: { trustedOrigins: ['*'] },
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				// google fonts: layout.css imports the stylesheet, which pulls the font files
				'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
				'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
				'img-src': ['self', 'https:', 'data:', 'blob:'],
				'media-src': ['self', 'https:', 'blob:'],
				'connect-src': [
					'self',
					'https://*.sentry.io',
					'https://*.ingest.sentry.io',
					// vite's hmr socket and dev requests, never in a build
					...(process.env.NODE_ENV !== 'production'
						? ['ws://localhost:*', 'http://localhost:*']
						: [])
				],
				'object-src': ['none'],
				'base-uri': ['self'],
				'frame-ancestors': ['none'],
				'worker-src': ['self', 'blob:']
				// no form-action: /oauth/authorize answers a form post with a 303 to the client's
				// redirect_uri, which chrome checks against it
			}
		}
	}
};

export default config;
