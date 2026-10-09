import { browser } from '$app/environment';
import { slugName } from '$lib/settingsRules';

export interface PersonalTemplate {
	id: string;
	name: string;
	body: string;
	enabled: boolean;
	builtIn: boolean;
}

const storageKey = 'ari-personal-templates';

const defaultTemplates: PersonalTemplate[] = [
	{
		id: 'default-snippet1',
		name: 'snippet1',
		body: 'Snippet body 1.',
		enabled: true,
		builtIn: true
	},
	{
		id: 'default-snippet2',
		name: 'snippet2',
		body: 'Snippet body 2.',
		enabled: true,
		builtIn: true
	}
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object';
}

function readStored(): PersonalTemplate[] | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return null;
		const cleaned = parsed
			.filter(isRecord)
			.map((entry) => ({
				id: typeof entry.id === 'string' ? entry.id : '',
				name: slugName(String(entry.name ?? '')),
				body: String(entry.body ?? '').trim(),
				enabled: entry.enabled !== false,
				builtIn: entry.builtIn === true
			}))
			.filter((entry) => entry.id && entry.name && entry.body);
		return cleaned.length ? cleaned : null;
	} catch {
		return null;
	}
}

function withDefaults(stored: PersonalTemplate[]): PersonalTemplate[] {
	const merged = [...stored];
	for (const fallback of defaultTemplates) {
		const existing = merged.find((template) => template.id === fallback.id);
		if (!existing) merged.push({ ...fallback });
		else {
			existing.name = fallback.name;
			existing.builtIn = true;
			if (!existing.body) existing.body = fallback.body;
		}
	}
	return merged;
}

function createPersonalTemplates() {
	let items = $state<PersonalTemplate[]>([...defaultTemplates]);
	if (browser) {
		const stored = readStored();
		if (stored) items = withDefaults(stored);
	}

	function persist() {
		if (!browser) return;
		localStorage.setItem(storageKey, JSON.stringify(items));
	}

	function nameTaken(name: string, exceptId: string | null): boolean {
		return items.some((template) => template.id !== exceptId && template.name === name);
	}

	return {
		get list() {
			return items;
		},
		get enabled() {
			return items.filter((template) => template.enabled);
		},
		add(nameRaw: string, bodyRaw: string): string | null {
			const name = slugName(nameRaw);
			const body = bodyRaw.trim();
			if (!name) return 'Give the template a name.';
			if (!body) return 'Template text is empty.';
			if (body.length > 5000) return 'Template text is too long (5000 max).'; // 5000: the longest template the editor stores
			if (nameTaken(name, null)) return `A template named /${name} already exists.`;
			items = [
				...items,
				{ id: `custom-${crypto.randomUUID()}`, name, body, enabled: true, builtIn: false }
			];
			persist();
			return null;
		},
		update(templateId: string, nameRaw: string, bodyRaw: string): string | null {
			const target = items.find((template) => template.id === templateId);
			if (!target || target.builtIn) return 'Only custom templates can be edited.';
			const name = slugName(nameRaw);
			const body = bodyRaw.trim();
			if (!name) return 'Give the template a name.';
			if (!body) return 'Template text is empty.';
			if (body.length > 5000) return 'Template text is too long (5000 max).'; // 5000: the longest template the editor stores
			if (nameTaken(name, templateId)) return `A template named /${name} already exists.`;
			items = items.map((template) =>
				template.id === templateId ? { ...template, name, body } : template
			);
			persist();
			return null;
		},
		remove(templateId: string): void {
			const target = items.find((template) => template.id === templateId);
			if (!target || target.builtIn) return;
			items = items.filter((template) => template.id !== templateId);
			persist();
		},
		setEnabled(templateId: string, enabled: boolean): void {
			if (!items.some((template) => template.id === templateId)) return;
			items = items.map((template) =>
				template.id === templateId ? { ...template, enabled } : template
			);
			persist();
		}
	};
}

export const personalTemplates = createPersonalTemplates();
