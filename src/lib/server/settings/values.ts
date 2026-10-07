import type { Prisma } from '$db';
import { db } from '$lib/server/db';
import { webhooksBaseUrl } from '$lib/server/webhooks';
import type { SettingsValues, ToolsDraft } from '$lib/settingsRules';

export const settingsProgramInclude = {
	checklist: { orderBy: { order: 'asc' } },
	reviewFields: { orderBy: { order: 'asc' } },
	snippets: { orderBy: { name: 'asc' } }
} as const satisfies Prisma.ProgramInclude;

export type SettingsProgram = Prisma.ProgramGetPayload<{
	include: typeof settingsProgramInclude;
}>;

export const settingsValuesOf = (
	program: SettingsProgram,
	outbound: { url: string | null; enabled: boolean } | null
): SettingsValues => ({
	displayName: program.name,
	iconUrl: program.iconUrl ?? '',
	cardBgUrl: program.cardBgUrl ?? '',
	trackingStartsAt: program.trackingStartsAt?.toISOString().slice(0, 10) ?? '',
	accepts: {
		commits: program.accepts.includes('commits'),
		elapsed: program.accepts.includes('elapsed'),
		devlog: program.accepts.includes('devlog')
	},
	collaborative: program.collaborative,
	secondPass: program.secondPass,
	secondPassApproved: program.secondPassApproved,
	secondPassChanges: program.secondPassChanges,
	secondPassRejected: program.secondPassRejected,
	secondPassOrganizerBypass: program.secondPassOrganizerBypass,
	screenIdentity: program.screenIdentity,
	screenHackatime: program.screenHackatime,
	reviewersCannotReviewOwnProjects: program.reviewersCannotReviewOwnProjects,
	allowDeflation: program.allowDeflation,
	hoursJustification: program.hoursJustification,
	reviewerReauth: program.reviewerReauth,
	reviewerReauthTtlMinutes: String(program.reviewerReauthTtlMinutes),
	priorityReview: program.priorityReview,
	priorityReviewMessage: program.priorityReviewMessage ?? '',
	reviewGoal: String(program.weeklyReviewGoal),
	reviewersChannel: program.reviewersChannelId ?? '',
	outUrl: outbound?.url ?? '',
	outEnabled: outbound?.enabled ?? true
});

export const toolsDraftOf = (program: SettingsProgram): ToolsDraft => ({
	checklist: program.checklist.map((item) => ({
		id: item.id,
		label: item.label,
		tracks: item.tracks
	})),
	fields: program.reviewFields.map((field) => ({
		id: field.id,
		type: field.type,
		label: field.label,
		description: field.description,
		key: field.key,
		options: field.options,
		required: field.required,
		tracks: field.tracks
	})),
	snippets: program.snippets.map((snippet) => ({
		id: snippet.id,
		name: snippet.name,
		body: snippet.body
	}))
});

export const ingestEndpointFor = (programId: string): string | null => {
	const base = webhooksBaseUrl();
	return base ? `${base}/api/ingest/${programId}` : null;
};

export async function loadSettingsProgram(programId: string) {
	const [program, outbound] = await Promise.all([
		db.program.findUnique({ where: { id: programId }, include: settingsProgramInclude }),
		db.outboundEndpoint.findUnique({ where: { programId } })
	]);
	return { program, outbound };
}
