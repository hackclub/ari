import {
	evidenceKinds,
	settingsTexts,
	settingsToggles,
	type SettingsValues
} from '$lib/settingsRules';

const renamedKeys = {
	name: 'displayName',
	outboundUrl: 'outUrl',
	outboundEnabled: 'outEnabled'
} as const;

const wholeNumberKeys = ['reviewGoal', 'reviewerReauthTtlMinutes'] as const;

type TextKey = (typeof settingsTexts)[number];
type ToggleKey = (typeof settingsToggles)[number];

const toggleKeys = new Set<string>(settingsToggles);

export const settingsPatchKeys: string[] = [
	'evidence',
	...Object.keys(renamedKeys),
	...settingsTexts,
	...settingsToggles
];

export type PatchResult = { ok: true; values: SettingsValues } | { ok: false; error: string };

const bad = (error: string): PatchResult => ({ ok: false, error });

export function applySettingsPatch(
	current: SettingsValues,
	patch: Record<string, unknown>
): PatchResult {
	const values: SettingsValues = { ...current, accepts: { ...current.accepts } };
	const unknown = Object.keys(patch).filter((key) => !settingsPatchKeys.includes(key));
	if (unknown.length) return bad(`Unknown settings: ${unknown.join(', ')}.`);

	for (const [key, given] of Object.entries(patch)) {
		if (given === undefined) continue;
		const target = (renamedKeys as Record<string, string>)[key] ?? key;

		if (target === 'evidence') {
			if (!Array.isArray(given)) return bad('evidence must be an array.');
			const wanted = given.map(String);
			const stray = wanted.filter((kind) => !(evidenceKinds as readonly string[]).includes(kind));
			if (stray.length) return bad(`Unknown evidence kinds: ${stray.join(', ')}.`);
			for (const kind of evidenceKinds) values.accepts[kind] = wanted.includes(kind);
		} else if (toggleKeys.has(target)) {
			if (typeof given !== 'boolean') return bad(`${key} must be true or false.`);
			values[target as ToggleKey] = given;
		} else if ((wholeNumberKeys as readonly string[]).includes(target)) {
			if (typeof given !== 'number' || !Number.isInteger(given)) {
				return bad(`${key} must be a whole number.`);
			}
			values[target as 'reviewGoal' | 'reviewerReauthTtlMinutes'] = String(given);
		} else {
			if (typeof given !== 'string') return bad(`${key} must be a string.`);
			values[target as Exclude<TextKey, (typeof wholeNumberKeys)[number]>] = given.trim();
		}
	}
	return { ok: true, values };
}

// fields the private cards own travel with the form under their own names
export function settingsFormFrom(
	values: SettingsValues,
	privateEntries: Record<string, string> = {}
): FormData {
	const form = new FormData();
	for (const kind of evidenceKinds) if (values.accepts[kind]) form.set(`accept_${kind}`, 'on');
	for (const key of settingsToggles) if (values[key]) form.set(key, 'on');
	for (const key of settingsTexts) form.set(key, values[key]);
	for (const [key, entry] of Object.entries(privateEntries)) form.set(key, entry);
	return form;
}

const reservedFormKeys = new Set<string>([...settingsToggles, ...settingsTexts]);

export function privateEntriesFrom(
	input: unknown
): { ok: true; entries: Record<string, string> } | { ok: false; error: string } {
	if (input === undefined || input === null) return { ok: true, entries: {} };
	if (typeof input !== 'object' || Array.isArray(input)) {
		return { ok: false, error: 'privateSettings must be an object of string values.' };
	}
	const entries: Record<string, string> = {};
	for (const [key, entry] of Object.entries(input)) {
		if (typeof entry !== 'string') {
			return { ok: false, error: `privateSettings.${key} must be a string.` };
		}
		if (reservedFormKeys.has(key) || key.startsWith('accept_')) {
			return { ok: false, error: `privateSettings.${key} is a public setting. Set it directly.` };
		}
		entries[key] = entry;
	}
	return { ok: true, entries };
}

// the shape the api reads and writes: a read can be sent back as a patch unchanged
export function settingsToApi(values: SettingsValues) {
	const {
		displayName,
		outUrl,
		outEnabled,
		accepts,
		reviewGoal,
		reviewerReauthTtlMinutes,
		...rest
	} = values;
	return {
		...rest,
		name: displayName,
		evidence: evidenceKinds.filter((kind) => accepts[kind]),
		reviewGoal: Number(reviewGoal),
		reviewerReauthTtlMinutes: Number(reviewerReauthTtlMinutes),
		outboundUrl: outUrl,
		outboundEnabled: outEnabled
	};
}
