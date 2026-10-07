import { db } from '$lib/server/db';
import { hasPermission, trackScope } from '$lib/server/authz';
import { integrationKinds } from '$lib/server/activityLog';
import { programFor, reachablePrograms, shipsWhere } from './access';
import { clampLimit, submissionStatuses, type Tool } from './shared';

export const listPrograms: Tool = {
	spec: {
		name: 'list_programs',
		description:
			'List the programs you can open, with status, accepted evidence types, and how many of the submissions you can see are awaiting review. members is null unless you can view the program’s reviewers.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	handler: async (_args, context) => {
		const reachable = await reachablePrograms(context);
		const programs = await db.program.findMany({
			where: { id: { in: reachable.map((program) => program.id) } },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				name: true,
				status: true,
				accepts: true,
				collaborative: true,
				allowVms: true,
				secondPass: true,
				weeklyReviewGoal: true,
				_count: { select: { memberships: true } }
			}
		});
		const pending = await db.submission.groupBy({
			by: ['programId'],
			where: { status: 'pending', ...shipsWhere(context, reachable) },
			_count: true
		});
		const pendingByProgram = new Map(pending.map((group) => [group.programId, group._count]));
		return programs.map((program) => ({
			id: program.id,
			name: program.name,
			status: program.status,
			accepts: program.accepts,
			collaborative: program.collaborative,
			allowVms: program.allowVms,
			secondPass: program.secondPass,
			weeklyReviewGoal: program.weeklyReviewGoal,
			members: hasPermission(context.user, program.id, 'VIEW_REVIEWERS')
				? program._count.memberships
				: null,
			pending: pendingByProgram.get(program.id) ?? 0
		}));
	}
};

export const programStats: Tool = {
	spec: {
		name: 'program_stats',
		description:
			'Counts of the submissions you can see in one program, by status. Reviewer headcount and the point of contact are included when you can view the program’s reviewers.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' }
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const found = await programFor(context, args.program);
		const program = { id: found.id, name: found.name, status: found.status };
		const grouped = await db.submission.groupBy({
			by: ['status'],
			where: shipsWhere(context, [found]),
			_count: true
		});
		const byStatus: Record<string, number> = {};
		for (const status of submissionStatuses) byStatus[status] = 0;
		for (const group of grouped) byStatus[group.status] = group._count;
		const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
		if (!hasPermission(context.user, program.id, 'VIEW_REVIEWERS')) {
			return { program, submissionsByStatus: byStatus, total };
		}
		const members = await db.membership.findMany({
			where: { programId: program.id },
			select: { permissions: true, isPoc: true, user: { select: { email: true } } }
		});
		return {
			program,
			submissionsByStatus: byStatus,
			total,
			members: members.length,
			operators: members.filter((member) => member.isPoc || member.permissions.length > 0).length,
			poc: members.find((member) => member.isPoc)?.user.email ?? null
		};
	}
};

export const getProgram: Tool = {
	spec: {
		name: 'get_program',
		description:
			'Full configuration for one program: status, accepted evidence, feature flags (collaborative/VMs/second-pass), checklist items, custom review fields, flag rules, and whether an outbound webhook is configured. Needs MANAGE_SETTINGS on the program.',
		inputSchema: {
			type: 'object',
			properties: { program: { type: 'string', description: 'Program id.' } },
			required: ['program'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { id } = await programFor(context, args.program, 'MANAGE_SETTINGS');
		const program = await db.program.findUnique({
			where: { id },
			include: {
				checklist: { orderBy: { order: 'asc' }, select: { order: true, label: true } },
				reviewFields: {
					select: { key: true, type: true, label: true, required: true, options: true }
				},
				flagRules: { select: { kind: true, enabled: true } },
				outboundEndpoint: { select: { url: true, enabled: true, last4: true } },
				_count: { select: { memberships: true, submissions: true, snippets: true } }
			}
		});
		if (!program) throw new Error('Program vanished.');
		return {
			id: program.id,
			name: program.name,
			status: program.status,
			accepts: program.accepts,
			weeklyReviewGoal: program.weeklyReviewGoal,
			collaborative: program.collaborative,
			allowVms: program.allowVms,
			secondPass: program.secondPass,
			checklist: program.checklist,
			reviewFields: program.reviewFields,
			flagRules: program.flagRules,
			outbound: program.outboundEndpoint
				? {
						configured: true,
						enabled: program.outboundEndpoint.enabled,
						url: program.outboundEndpoint.url
					}
				: { configured: false },
			counts: program._count
		};
	}
};

export const listActivity: Tool = {
	spec: {
		name: 'list_activity',
		description:
			'Recent events in a program’s audit log (decisions, member changes, settings, flags), newest first, limited to your tracks. Needs VIEW_AUDIT_LOG on the program.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				limit: { type: 'number', description: 'Max rows (1-100, default 30).' }
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { id } = await programFor(context, args.program, 'VIEW_AUDIT_LOG');
		// the same filter as the audit log page
		const scope = trackScope(context.user, id);
		const inScope = scope
			? await db.submission.findMany({
					where: { programId: id, track: { in: scope } },
					select: { id: true }
				})
			: null;
		return db.activityEvent.findMany({
			where: {
				programId: id,
				kind: { notIn: [...integrationKinds] },
				...(inScope
					? {
							OR: [
								{ submissionId: null },
								{ submissionId: { in: inScope.map((submission) => submission.id) } }
							]
						}
					: {})
			},
			orderBy: { createdAt: 'desc' },
			take: clampLimit(args.limit, 30),
			select: { kind: true, text: true, createdAt: true, submissionId: true }
		});
	}
};
