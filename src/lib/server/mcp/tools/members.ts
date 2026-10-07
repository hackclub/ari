import { db } from '$lib/server/db';
import { requireOrgPermission, tokenReaches } from './access';
import { personInput, personWhere, type Tool } from './shared';

export const listUsers: Tool = {
	spec: {
		name: 'list_users',
		description:
			'Org users with their org permissions and per-program memberships (role + track scope). Optionally filter to users holding at least one org permission. Needs MANAGE_PEOPLE or GRANT_ORG_PERMS.',
		inputSchema: {
			type: 'object',
			properties: {
				withOrgPermissions: {
					type: 'boolean',
					description: 'Only users holding at least one org permission.'
				}
			},
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		requireOrgPermission(context, 'MANAGE_PEOPLE', 'GRANT_ORG_PERMS');
		const users = await db.user.findMany({
			where: args.withOrgPermissions ? { orgPermissions: { isEmpty: false } } : {},
			orderBy: { createdAt: 'asc' },
			select: {
				id: true,
				name: true,
				email: true,
				slackId: true,
				orgPermissions: true,
				lastSeenAt: true,
				memberships: {
					select: {
						permissions: true,
						isPoc: true,
						tracks: true,
						program: { select: { id: true } }
					}
				}
			}
		});
		return users.map((user) => ({
			...user,
			memberships: user.memberships.map((membership) => ({
				program: membership.program.id,
				permissions: membership.permissions,
				isPoc: membership.isPoc,
				tracks: membership.tracks
			}))
		}));
	}
};

export const whoami: Tool = {
	spec: {
		name: 'whoami',
		description:
			'Identity behind the current token: the owning user, their org permissions and their memberships in the programs this token reaches, the token label, whether it can write, and the programs it is limited to (empty = every program the owner can reach).',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false }
	},
	handler: async (_args, context) => ({
		id: context.user.id,
		name: context.user.name,
		email: context.user.email,
		orgPermissions: context.user.orgPermissions,
		memberships: context.user.memberships.filter((membership) =>
			tokenReaches(context, membership.programId)
		),
		token: context.tokenLabel,
		canWrite: context.canWrite,
		programIds: context.programIds
	})
};

export const getUser: Tool = {
	spec: {
		name: 'get_user',
		description:
			'Detail for one reviewer/organizer, resolved by email, Slack id, or name: org permissions, per-program memberships (role + tracks), review count, last seen, and their most recent decisions. Needs MANAGE_PEOPLE or GRANT_ORG_PERMS.',
		inputSchema: {
			type: 'object',
			properties: { ...personInput },
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		requireOrgPermission(context, 'MANAGE_PEOPLE', 'GRANT_ORG_PERMS');
		const { conditions } = personWhere(args);
		const user = await db.user.findFirst({
			where: { OR: conditions },
			include: {
				memberships: { include: { program: { select: { id: true, name: true } } } },
				_count: { select: { reviews: true } },
				reviews: {
					orderBy: { createdAt: 'desc' },
					take: 10,
					select: {
						decision: true,
						approvedMinutes: true,
						approvedSeconds: true,
						createdAt: true,
						submission: { select: { id: true, title: true } }
					}
				}
			}
		});
		if (!user) throw new Error('No reviewer/organizer matches that email, Slack id, or name.');
		return {
			id: user.id,
			name: user.name,
			email: user.email,
			slackId: user.slackId,
			orgPermissions: user.orgPermissions,
			lastSeenAt: user.lastSeenAt,
			totalReviews: user._count.reviews,
			memberships: user.memberships.map((membership) => ({
				program: membership.program.id,
				programName: membership.program.name,
				permissions: membership.permissions,
				isPoc: membership.isPoc,
				tracks: membership.tracks
			})),
			recentReviews: user.reviews
		};
	}
};
