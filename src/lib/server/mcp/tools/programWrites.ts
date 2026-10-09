import { db } from '$lib/server/db';
import { hasOrgPermission } from '$lib/server/authz';
import {
	createProgram,
	organizerFilter,
	updateProgram,
	type CreateProgramInput
} from '$lib/server/programs';
import { patchSettings } from '$lib/server/settings/patchSave';
import { ingestEndpointFor } from '$lib/server/settings/values';
import { emptyProgramDraft, evidenceKinds } from '$lib/programRules';
import { settingsProperties } from './settingsSchema';
import { programFor, requireOrgWide } from './access';
import { requireWrite, unwrap, type Tool } from './shared';

const evidenceSchema = {
	type: 'array',
	items: { type: 'string', enum: evidenceKinds },
	description: 'Accepted evidence kinds. The complete set.'
};
const emailsSchema = { type: 'array', items: { type: 'string' } };

function text(args: Record<string, unknown>, key: string): string | undefined {
	const value = args[key];
	if (value === undefined) return undefined;
	if (typeof value !== 'string') throw new Error(`${key} must be a string.`);
	return value.trim();
}

function flag(args: Record<string, unknown>, key: string): boolean | undefined {
	const value = args[key];
	if (value === undefined) return undefined;
	if (typeof value !== 'boolean') throw new Error(`${key} must be true or false.`);
	return value;
}

function list(args: Record<string, unknown>, key: string): string[] | undefined {
	const value = args[key];
	if (value === undefined) return undefined;
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		throw new Error(`${key} must be an array of strings.`);
	}
	return value.map((entry: string) => entry.trim());
}

function evidenceList(args: Record<string, unknown>): string[] | undefined {
	const kinds = list(args, 'evidence');
	const stray = kinds?.filter((kind) => !(evidenceKinds as string[]).includes(kind));
	if (stray?.length) throw new Error(`Unknown evidence kinds: ${stray.join(', ')}.`);
	return kinds;
}

function emailList(args: Record<string, unknown>, key: string): string[] | undefined {
	const emails = list(args, key);
	const stray = emails?.filter((email) => !/^[^\s@]+@[^\s@]+$/.test(email));
	if (stray?.length) throw new Error(`Not an email address: ${stray.join(', ')}.`);
	return emails;
}

function accentColor(args: Record<string, unknown>): string | undefined {
	const accent = text(args, 'accent');
	if (accent && !/^#[0-9a-fA-F]{6}$/.test(accent)) throw new Error('accent must be #rrggbb.');
	return accent;
}

function privateValues(args: Record<string, unknown>): Record<string, string> {
	const value = args.privateValues ?? {};
	if (typeof value !== 'object' || Array.isArray(value) || value === null) {
		throw new Error('privateValues must be an object of string values.');
	}
	const entries = Object.entries(value);
	if (entries.some((entry) => typeof entry[1] !== 'string')) {
		throw new Error('privateValues must be an object of string values.');
	}
	return Object.fromEntries(entries) as Record<string, string>;
}

export const createProgramTool: Tool = {
	spec: {
		name: 'create_program',
		description:
			'(write) Create a program, like the new-program wizard. Needs a name, a tracking start date and a reviewers Slack channel the Ari Slack app has been invited to. Organizers are added by email: people who have not signed in yet get an invite. `settings` takes anything update_program_settings does (icon, card background, review flow, outbound webhook url) and is applied right after creation; if that part fails the program still exists and the reply says so. A fresh program has an inbound signing secret nobody has seen: call roll_ingest_secret to get one. Needs CREATE_PROGRAMS (or MANAGE_PROGRAMS) on the token owner.',
		inputSchema: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				trackingStartsAt: { type: 'string', description: 'YYYY-MM-DD.' },
				reviewersChannel: settingsProperties.reviewersChannel,
				accent: { type: 'string', description: 'Accent colour as #rrggbb.' },
				evidence: { ...evidenceSchema, description: 'Default ["commits","elapsed"].' },
				organizers: { ...emailsSchema, description: 'Organizer emails.' },
				poc: { type: 'string', description: 'Point-of-contact email, one of the organizers.' },
				allowVms: { type: 'boolean', description: 'Needs MANAGE_PROGRAMS on the token owner.' },
				settings: {
					type: 'object',
					properties: settingsProperties,
					additionalProperties: false,
					description: 'Further settings, applied after creation.'
				},
				privateValues: {
					type: 'object',
					additionalProperties: { type: 'string' },
					description:
						'Values the private provider’s wizard steps record (fraud and flag setup), as strings.'
				}
			},
			required: ['name', 'trackingStartsAt', 'reviewersChannel'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		requireOrgWide(context);
		const draft = emptyProgramDraft();
		const input: CreateProgramInput = {
			name: text(args, 'name') ?? '',
			accent: accentColor(args) ?? draft.accent,
			evidence: evidenceList(args) ?? draft.evidence,
			allowVms: flag(args, 'allowVms') ?? false,
			secondPass: draft.secondPass,
			organizers: emailList(args, 'organizers') ?? [],
			poc: emailList({ poc: [text(args, 'poc') ?? ''].filter(Boolean) }, 'poc')?.[0] ?? '',
			reviewersChannel: text(args, 'reviewersChannel') ?? '',
			trackingStartsAt: text(args, 'trackingStartsAt') ?? '',
			cantReviewOwn: draft.cantReviewOwn,
			allowDeflation: draft.allowDeflation,
			hoursJustification: draft.hoursJustification,
			secondPassApproved: draft.secondPassApproved,
			secondPassChanges: draft.secondPassChanges,
			secondPassRejected: draft.secondPassRejected,
			secondPassOrganizerBypass: draft.secondPassOrganizerBypass,
			priorityReview: draft.priorityReview,
			reviewerReauth: draft.reviewerReauth,
			reviewerReauthTtlMinutes: draft.reviewerReauthTtlMinutes,
			reviewGoal: draft.reviewGoal,
			stepValues: privateValues(args)
		};
		const { id } = unwrap(await createProgram(context.user, input));

		const created = { created: true, program: id, ingestEndpoint: ingestEndpointFor(id) };
		const settings = args.settings;
		if (settings === undefined) return created;
		if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
			return { ...created, settingsApplied: false, settingsError: 'settings must be an object.' };
		}
		const applied = await patchSettings(id, context.user, settings as Record<string, unknown>);
		return applied.ok
			? { ...created, settingsApplied: true }
			: { ...created, settingsApplied: false, settingsError: applied.error };
	}
};

async function currentCore(programId: string) {
	const [program, members, invites, poc] = await Promise.all([
		db.program.findUniqueOrThrow({ where: { id: programId } }),
		db.membership.findMany({
			where: { programId, ...organizerFilter },
			select: { user: { select: { email: true } } }
		}),
		db.invite.findMany({
			where: { programId, ...organizerFilter, acceptedAt: null },
			select: { email: true }
		}),
		db.membership.findFirst({
			where: { programId, isPoc: true },
			select: { user: { select: { email: true } } }
		})
	]);
	return {
		program,
		organizers: [
			...members.map((member) => member.user.email),
			...invites.map((invite) => invite.email)
		],
		poc: poc?.user.email ?? ''
	};
}

export const updateProgramTool: Tool = {
	spec: {
		name: 'update_program',
		description:
			'(write) Edit a program’s name, accent colour, accepted evidence, reviewer VMs, second pass, organizers and point of contact, like the admin edit dialog. Send only what changes. `organizers` is the complete organizer list: anyone not in it loses organizer access. To add one person, use add_member with every program permission instead. Needs MANAGE_PROGRAMS on the token owner.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				name: { type: 'string' },
				accent: { type: 'string', description: 'Accent colour as #rrggbb.' },
				evidence: evidenceSchema,
				allowVms: { type: 'boolean' },
				secondPass: { type: 'boolean' },
				organizers: { ...emailsSchema, description: 'Complete organizer email list.' },
				poc: { type: 'string', description: 'Point-of-contact email; empty string clears it.' }
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		if (!hasOrgPermission(context.user, 'MANAGE_PROGRAMS')) {
			throw new Error('The token owner does not hold MANAGE_PROGRAMS.');
		}
		const { id } = await programFor(context, args.program);
		const current = await currentCore(id);
		const poc = args.poc === undefined ? current.poc : (text(args, 'poc') ?? '');
		unwrap(
			await updateProgram(context.user, {
				programId: id,
				name: text(args, 'name') ?? current.program.name,
				accent: accentColor(args) ?? '',
				evidence: evidenceList(args) ?? current.program.accepts,
				allowVms: flag(args, 'allowVms') ?? current.program.allowVms,
				secondPass: flag(args, 'secondPass') ?? current.program.secondPass,
				organizers: emailList(args, 'organizers') ?? current.organizers,
				poc
			})
		);
		return { updated: true, program: id };
	}
};
