import { browser } from '$app/environment';

function createCustomCss() {
	let text = $state(browser ? (localStorage.getItem('ari-custom-css') ?? '') : '');

	return {
		get text() {
			return text;
		},
		save(next: string) {
			text = next;
			if (!browser) return;
			if (next) localStorage.setItem('ari-custom-css', next);
			else localStorage.removeItem('ari-custom-css');
		}
	};
}

export const customCss = createCustomCss();
