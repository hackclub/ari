export type ThemeFamily = 'default' | 'nord' | 'dracula' | 'catppuccin' | 'custom';

export interface ThemeFamilyMeta {
	id: ThemeFamily;
	label: string;
	description: string;
	supportsLight: boolean;
}

export const themeFamilies: ThemeFamilyMeta[] = [
	{
		id: 'default',
		label: 'Ari',
		description: 'The classic Hack Club red, in light and dark.',
		supportsLight: true
	},
	{
		id: 'nord',
		label: 'Nord',
		description: 'Cool arctic blues, in light and dark.',
		supportsLight: true
	},
	{
		id: 'dracula',
		label: 'Dracula',
		description: 'Dark-only purple haze.',
		supportsLight: false
	},
	{
		id: 'catppuccin',
		label: 'Catppuccin',
		description: 'Latte by day, Mocha by night.',
		supportsLight: true
	},
	{
		id: 'custom',
		label: 'Custom',
		description: 'Your own accent color on the Ari surfaces.',
		supportsLight: true
	}
];

export const familySupportsLight = (family: ThemeFamily): boolean =>
	themeFamilies.find((entry) => entry.id === family)?.supportsLight ?? true;

// starter accents that stay readable on both light and dark surfaces
export const customAccentPresets = [
	'#ec3750',
	'#d6336c',
	'#8a27b8',
	'#1f6dbf',
	'#15788c',
	'#0f8a5f',
	'#c2620a',
	'#3f7e93'
];
