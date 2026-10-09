import { privateProvider } from '$private';
import { allTracks } from '$lib/data';
import { fieldTypes } from '$lib/settingsRules';
import { uploadImage } from '$lib/server/imageUpload';
import { patchSettings } from '$lib/server/settings/patchSave';
import { settingsToApi } from '$lib/server/settings/patch';
import {
	activeIngestSecret,
	maskSecret,
	rollIngestSecret,
	rollOutboundSecret
} from '$lib/server/settings/secrets';
import { saveTools } from '$lib/server/settings/tools';
import {
	ingestEndpointFor,
	loadSettingsProgram,
	settingsValuesOf,
	toolsDraftOf
} from '$lib/server/settings/values';
import { privateSettingsProperty, settingsProperties } from './settingsSchema';
import { programFor } from './access';
import { requireWrite, unwrap, type Tool } from './shared';

const trackList = {
	type: 'array',
	items: { type: 'string', enum: allTracks },
	description: 'Tracks the item applies to (default both).'
};

async function readSettings(programId: string) {
	const { program, outbound } = await loadSettingsProgram(programId);
	if (!program) throw new Error('Program not found.');
	return { program, outbound };
}

export const getProgramSettings: Tool = {
	spec: {
		name: 'get_program_settings',
		description:
			'Everything the program settings page shows (needs MANAGE_SETTINGS on the program): settings (in the same names update_program_settings takes), the checklist, review fields and snippets, the private provider’s settings (flag rules and screening), the ingest endpoint and masked signing secrets. Secrets are never returned here.',
		inputSchema: {
			type: 'object',
			properties: { program: { type: 'string', description: 'Program id.' } },
			required: ['program'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { id, status } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const [{ program, outbound }, ingestSecret, privateSettings] = await Promise.all([
			readSettings(id),
			activeIngestSecret(id),
			privateProvider.settingsLoad(id)
		]);
		return {
			program: id,
			status,
			settings: settingsToApi(settingsValuesOf(program, outbound)),
			tools: toolsDraftOf(program),
			privateSettings,
			ingestEndpoint: ingestEndpointFor(id),
			ingestSecretMasked: ingestSecret ? maskSecret(ingestSecret.last4) : null,
			outboundSecretMasked: outbound?.last4 ? maskSecret(outbound.last4) : null,
			priorityFormPath: program.priorityReviewToken
				? `/priority/${program.priorityReviewToken}`
				: null
		};
	}
};

export const updateProgramSettings: Tool = {
	spec: {
		name: 'update_program_settings',
		description:
			'(write) Change program settings, like the settings page: name, icon and card background urls, tracking start, accepted evidence, reviewers channel, review flow (second pass, deflation, justification, reauth, screening, priority review), the weekly goal and the outbound webhook url. Send only what changes; everything else stays. Validated and logged exactly as the settings page does.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				...settingsProperties,
				privateSettings: privateSettingsProperty
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const patch = { ...args };
		delete patch.program;
		delete patch.privateSettings;
		unwrap(await patchSettings(id, context.user, patch, args.privateSettings));
		const { program, outbound } = await readSettings(id);
		return {
			updated: true,
			program: id,
			settings: settingsToApi(settingsValuesOf(program, outbound))
		};
	}
};

const withTracks = (entries: unknown): unknown =>
	Array.isArray(entries)
		? entries.map((entry) =>
				entry && typeof entry === 'object' && !('tracks' in entry)
					? { ...entry, tracks: allTracks }
					: entry
			)
		: entries;

export const setReviewTools: Tool = {
	spec: {
		name: 'set_review_tools',
		description:
			'(write) Replace the checklist, custom review fields and/or snippets of a program. Each list you send is the complete new list: include an existing item’s id (from get_program_settings) to keep and update it, leave the id off to add one, and anything left out is deleted. Lists you do not send are untouched.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				checklist: {
					type: 'array',
					items: {
						type: 'object',
						properties: { id: { type: 'string' }, label: { type: 'string' }, tracks: trackList },
						required: ['label'],
						additionalProperties: false
					}
				},
				fields: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'string' },
							type: { type: 'string', enum: fieldTypes.map((entry) => entry.value) },
							label: { type: 'string' },
							description: { type: 'string' },
							key: { type: 'string', description: 'Value name; defaults to the label.' },
							options: { type: 'array', items: { type: 'string' } },
							required: { type: 'boolean' },
							tracks: trackList
						},
						required: ['type', 'label'],
						additionalProperties: false
					}
				},
				snippets: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							id: { type: 'string' },
							name: { type: 'string', description: 'Trigger: typing /name inserts the body.' },
							body: { type: 'string' }
						},
						required: ['name', 'body'],
						additionalProperties: false
					}
				}
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const { program } = await readSettings(id);
		const current = toolsDraftOf(program);
		const form = new FormData();
		form.set('checklist', JSON.stringify(withTracks(args.checklist) ?? current.checklist));
		form.set('fields', JSON.stringify(withTracks(args.fields) ?? current.fields));
		form.set('snippets', JSON.stringify(args.snippets ?? current.snippets));
		unwrap(await saveTools(id, context.user.id, form));
		return { updated: true, program: id, tools: toolsDraftOf((await readSettings(id)).program) };
	}
};

export const uploadProgramImage: Tool = {
	spec: {
		name: 'upload_program_image',
		description:
			'(write) Upload a program icon or card background and set it on the program. Needs image storage configured on this instance; otherwise host the image yourself and pass its url to update_program_settings. Max 8 MB; png, jpeg, gif, webp, avif or svg.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				kind: { type: 'string', enum: ['icon', 'cardBg'] },
				contentType: { type: 'string', description: 'For example image/png.' },
				dataBase64: { type: 'string', description: 'The image bytes, base64 encoded.' }
			},
			required: ['program', 'kind', 'contentType', 'dataBase64'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		if (args.kind !== 'icon' && args.kind !== 'cardBg') {
			throw new Error('kind must be "icon" or "cardBg".');
		}
		const bytes = new Uint8Array(Buffer.from(String(args.dataBase64), 'base64'));
		const file = new File([bytes], 'upload', { type: String(args.contentType) });
		const { url } = unwrap(await uploadImage(file));
		const field = args.kind === 'icon' ? 'iconUrl' : 'cardBgUrl';
		unwrap(await patchSettings(id, context.user, { [field]: url }));
		return { uploaded: true, program: id, kind: args.kind, url };
	}
};

export const rollIngestSecretTool: Tool = {
	spec: {
		name: 'roll_ingest_secret',
		description:
			'(write) Issue a new inbound signing secret for a program and revoke the old one. The new secret is returned once, here, and nowhere else: sign requests to ingestEndpoint with it.',
		inputSchema: {
			type: 'object',
			properties: { program: { type: 'string', description: 'Program id.' } },
			required: ['program'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const { plaintext } = unwrap(await rollIngestSecret(id, context.user.id));
		return { program: id, ingestEndpoint: ingestEndpointFor(id), secret: plaintext };
	}
};

export const rollOutboundSecretTool: Tool = {
	spec: {
		name: 'roll_outbound_secret',
		description:
			'(write) Issue a new signing secret for the program’s outbound webhook. It is returned once, here: the receiver verifies Ari’s signature with it. Set the destination with update_program_settings outboundUrl.',
		inputSchema: {
			type: 'object',
			properties: { program: { type: 'string', description: 'Program id.' } },
			required: ['program'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const { plaintext } = unwrap(await rollOutboundSecret(id, context.user.id));
		return { program: id, secret: plaintext };
	}
};
