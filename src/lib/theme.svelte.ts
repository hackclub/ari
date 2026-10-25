import { browser } from '$app/environment';
import { familySupportsLight, type ThemeFamily } from '$lib/themes';

const familyKey = 'ari-theme-family';
const accentKey = 'ari-custom-accent';
const fallbackAccent = '#ec3750'; // the default primary, so a fresh custom theme matches ari

const hexColor = /^#[0-9a-f]{6}$/i;

function readFamily(): ThemeFamily {
	if (!browser) return 'default';
	const raw = localStorage.getItem(familyKey);
	return raw === 'nord' ||
		raw === 'dracula' ||
		raw === 'catppuccin' ||
		raw === 'custom' ||
		raw === 'default'
		? raw
		: 'default';
}

function readAccent(): string {
	if (!browser) return fallbackAccent;
	const raw = (localStorage.getItem(accentKey) ?? '').trim().toLowerCase();
	return hexColor.test(raw) ? raw : fallbackAccent;
}

function createTheme() {
	const initialFamily = readFamily();
	// matching the script in app.html, except dracula ships dark-only
	// so a stored light choice never applies to it
	let family = $state<ThemeFamily>(initialFamily);
	let dark = $state(
		initialFamily === 'dracula' ? true : !browser || localStorage.getItem('ari-theme') !== 'light'
	);
	let customAccent = $state(readAccent());
	// bumps on every theme change so canvas widgets can repaint
	let revision = $state(0);

	function persist() {
		if (!browser) return;
		localStorage.setItem('ari-theme', dark ? 'dark' : 'light');
		localStorage.setItem(familyKey, family);
		localStorage.setItem(accentKey, customAccent);
	}

	function apply() {
		revision += 1;
		if (!browser) return;
		const root = document.documentElement;
		root.dataset.theme = family;
		root.classList.toggle('dark', dark);
		if (family === 'custom') root.style.setProperty('--custom-accent', customAccent);
		else root.style.removeProperty('--custom-accent');
		persist();
	}

	function setDark(next: boolean) {
		dark = next;
		if (!dark && !familySupportsLight(family)) family = 'default';
		apply();
	}

	// the boot script in app.html already painted the stored theme, this just syncs the store
	apply();

	return {
		get family() {
			return family;
		},
		get dark() {
			return dark;
		},
		get customAccent() {
			return customAccent;
		},
		get revision() {
			return revision;
		},
		setFamily(next: ThemeFamily) {
			family = next;
			if (!familySupportsLight(next)) dark = true;
			apply();
		},
		setDark(next: boolean) {
			setDark(next);
		},
		toggle() {
			setDark(!dark);
		},
		setCustomAccent(next: string) {
			const cleaned = next.trim().toLowerCase();
			if (!hexColor.test(cleaned)) return;
			customAccent = cleaned;
			family = 'custom';
			apply();
		}
	};
}

export const theme = createTheme();
