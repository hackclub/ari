import { db } from '$lib/server/db';
import { systemUserId } from '$lib/server/systemUser';
import { hasOrgPermission } from '$lib/server/authz';
import { allOrgPermissions, allPermissions, allTracks } from '$lib/data';
import { permSummary, removeMember as removeMemberAs, setMemberAccess } from '$lib/server/members';
import { queueOrgChannelSync, queueReviewersChannelSync } from '$lib/server/slackChannels';
import type { OrgPermission, ProgramPermission, Track } from '$db';
import { programFor, requireOrgWide } from './access';
import { requireWrite, unwrap, type Tool } from './shared';

const memberAndInviteCount = async (programId: string, email: string) =>
	(await db.membership.count({
		where: { programId, user: { email: { equals: email, mode: 'insensitive' } } }
	})) +
	(await db.invite.count({
		where: { programId, email: { equals: email, mode: 'insensitive' }, acceptedAt: null }
	}));

function parseTracks(input: unknown): Track[] {
	if (!Array.isArray(input)) return ['software'];
	const tracks = input.filter((entry): entry is Track => allTracks.includes(entry as Track));
	return tracks.length ? [...new Set(tracks)] : ['software'];
}

function parsePermissions(input: unknown): ProgramPermission[] {
	if (!Array.isArray(input)) return [];
	return allPermissions.filter((permission) => input.includes(permission));
}

export const addMember: Tool = {
	spec: {
		name: 'add_member',
		description:
			'(write) Add a member to a program with an optional set of permissions (empty = plain reviewer). Existing users get a membership immediately; people who have never signed in get an invite that activates on first login. Optionally set track scope.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				email: { type: 'string' },
				permissions: {
					type: 'array',
					items: { type: 'string', enum: allPermissions },
					description: 'Program permissions to grant (default none = plain reviewer).'
				},
				tracks: {
					type: 'array',
					items: { type: 'string', enum: ['software', 'hardware'] },
					description: 'Track scope for the member (default ["software"]).'
				}
			},
			required: ['program', 'email'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const program = await programFor(context, args.program, 'MANAGE_REVIEWERS');
		const email = String(args.email).trim().toLowerCase();
		if (!email) throw new Error('email is required.');
		const permissions = parsePermissions(args.permissions);
		const tracks = parseTracks(args.tracks);
		const summary = permSummary(permissions);

		// stored emails keep the identity provider's casing: an exact match would stack an
		// invite that person can never accept
		const existing = await db.user.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } },
			select: { id: true, email: true }
		});
		if (existing?.id === systemUserId) throw new Error('The system account cannot join programs.');

		if (existing) {
			const membershipKey = { userId_programId: { userId: existing.id, programId: program.id } };
			const previous = await db.membership.findUnique({
				where: membershipKey,
				select: { id: true }
			});
			// an existing member changes through the reviewers page path, which guards the poc
			if (previous) {
				unwrap(
					await setMemberAccess(program.id, context.user, existing.email, tracks, permissions)
				);
				return { result: 'updated', email, program: program.id, permissions, tracks };
			}
			await db.membership.create({
				data: { userId: existing.id, programId: program.id, permissions, tracks }
			});
			// the membership fulfils any pending invite, which could never be accepted at login
			await db.invite.updateMany({
				where: {
					email: { equals: email, mode: 'insensitive' },
					programId: program.id,
					acceptedAt: null
				},
				data: { acceptedAt: new Date() }
			});
			queueOrgChannelSync(existing.id);
			queueReviewersChannelSync(program.id, existing.id, 'add');
			await db.activityEvent.create({
				data: {
					programId: program.id,
					kind: 'MEMBER',
					actorId: context.user.id,
					text: `Added ${email} with ${summary}`,
					meta: { op: 'added', email, permissions, via: 'mcp' }
				}
			});
			return {
				result: 'added',
				email,
				program: program.id,
				permissions,
				tracks
			};
		}

		const pendingInvite = await db.invite.findFirst({
			where: { email, programId: program.id, acceptedAt: null }
		});
		if (!pendingInvite) {
			await db.invite.create({
				data: { email, programId: program.id, permissions, tracks }
			});
			await db.activityEvent.create({
				data: {
					programId: program.id,
					kind: 'MEMBER',
					actorId: context.user.id,
					text: `Invited ${email} with ${summary}`,
					meta: { op: 'invited', email, permissions, via: 'mcp' }
				}
			});
		}
		return {
			result: pendingInvite ? 'already-invited' : 'invited',
			email,
			program: program.id,
			permissions,
			tracks
		};
	}
};

export const removeMember: Tool = {
	spec: {
		name: 'remove_member',
		description:
			"(write) Remove a person's membership from one program. Does not delete their account or other-program access; pending invites for that program are revoked too.",
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				email: { type: 'string' }
			},
			required: ['program', 'email'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const program = await programFor(context, args.program, 'MANAGE_REVIEWERS');
		const email = String(args.email ?? '')
			.trim()
			.toLowerCase();
		const before = await memberAndInviteCount(program.id, email);
		unwrap(await removeMemberAs(program.id, context.user, email));
		const after = await memberAndInviteCount(program.id, email);
		return { removed: after < before, email, program: program.id };
	}
};

export const setOrgPermissions: Tool = {
	spec: {
		name: 'set_org_permissions',
		description:
			"(write) Replace a user's org permissions. The token owner must hold GRANT_ORG_PERMS, cannot change their own set, and can only add permissions they hold themselves (revoking is unrestricted).",
		inputSchema: {
			type: 'object',
			properties: {
				email: { type: 'string' },
				permissions: {
					type: 'array',
					items: { type: 'string', enum: allOrgPermissions },
					description: 'The complete new permission set (empty array = plain member).'
				}
			},
			required: ['email', 'permissions'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		requireOrgWide(context);
		if (!hasOrgPermission(context.user, 'GRANT_ORG_PERMS')) {
			throw new Error('The token owner does not hold GRANT_ORG_PERMS.');
		}
		const email = String(args.email).trim().toLowerCase();
		if (email === context.user.email.toLowerCase()) {
			throw new Error("You can't change your own org permissions.");
		}
		const requested = Array.isArray(args.permissions) ? args.permissions.map(String) : [];
		const unknown = requested.filter(
			(entry) => !allOrgPermissions.includes(entry as OrgPermission)
		);
		if (unknown.length) {
			throw new Error(`Unknown org permissions: ${unknown.join(', ')}.`);
		}
		const permissions = allOrgPermissions.filter((permission) => requested.includes(permission));
		// stored emails keep the identity provider's casing
		const user = await db.user.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } },
			select: { id: true, orgPermissions: true }
		});
		if (!user) throw new Error('No account with that email has signed in yet.');
		if (user.id === systemUserId) throw new Error("The system account's permissions can't change.");
		const added = permissions.filter((permission) => !user.orgPermissions.includes(permission));
		if (added.some((permission) => !hasOrgPermission(context.user, permission))) {
			throw new Error('You can only grant org permissions you hold yourself.');
		}
		if ([...user.orgPermissions].sort().join(',') !== [...permissions].sort().join(',')) {
			await db.user.update({ where: { id: user.id }, data: { orgPermissions: permissions } });
		}
		return { email, orgPermissions: permissions };
	}
};
