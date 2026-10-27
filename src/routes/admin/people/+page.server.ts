import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { requireUser, hasOrgPermission } from '$lib/server/authz';
import { systemUserId } from '$lib/server/systemUser';
import { ago } from '$lib/server/serialize';
import { allOrgPermissions, type OrgPermission } from '$lib/data';
import { queueOrgChannelBackfill } from '$lib/server/slackChannels';
import { invitePeople, removePerson, setUserOrgPermissions } from '$lib/server/people';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const viewer = requireUser(locals);
	const canManage = hasOrgPermission(viewer, 'MANAGE_PEOPLE');
	const canGrant = hasOrgPermission(viewer, 'GRANT_ORG_PERMS');
	// granting alone gets the directory read-only with just the permission editor
	if (!canManage && !canGrant) throw error(403, 'You do not have permission to do this');

	const [users, programRows, invites] = await Promise.all([
		db.user.findMany({
			where: { id: { not: systemUserId } },
			orderBy: { name: 'asc' },
			include: {
				memberships: { include: { program: { select: { name: true, color: true } } } },
				_count: { select: { reviews: true } }
			}
		}),
		db.program.findMany({
			orderBy: { name: 'asc' },
			select: { id: true, name: true, color: true, status: true }
		}),
		db.invite.findMany({ where: { acceptedAt: null }, orderBy: { createdAt: 'desc' } })
	]);

	// invites are stored lowercased while user emails keep the identity provider's casing
	const userEmails = new Set(users.map((user) => user.email.toLowerCase()));
	const programNames = new Map(programRows.map((program) => [program.id, program.name]));

	const userPeople = users.map((user) => ({
		name: user.name,
		email: user.email,
		role:
			user.orgPermissions.length > 0
				? 'Org'
				: user.memberships.some(
							(membership) => membership.isPoc || membership.permissions.length > 0
					  )
					? 'Organizer'
					: 'Reviewer',
		orgPermissions: user.orgPermissions as OrgPermission[],
		color: user.avatarColor,
		slackId: user.slackId as string | null,
		programs: user.memberships.map((membership) => membership.program.name),
		reviewed: user._count.reviews,
		last: ago(user.lastSeenAt),
		pending: false
	}));

	const pendingByEmail = new Map<string, { role: string; programs: string[] }>();
	for (const invite of invites) {
		if (userEmails.has(invite.email.toLowerCase())) continue;
		const entry = pendingByEmail.get(invite.email) ?? {
			role:
				invite.orgPermissions.length > 0
					? 'Org'
					: invite.permissions.length > 0
						? 'Organizer'
						: 'Reviewer',
			programs: []
		};
		const programName = invite.programId ? programNames.get(invite.programId) : undefined;
		if (programName) entry.programs.push(programName);
		pendingByEmail.set(invite.email, entry);
	}
	const invitedPeople = [...pendingByEmail].map(([email, entry]) => ({
		name: email.split('@')[0],
		email,
		role: entry.role,
		orgPermissions: [] as OrgPermission[],
		color: 'var(--text-3)',
		slackId: null as string | null,
		programs: entry.programs,
		reviewed: 0,
		last: 'Invited',
		pending: true
	}));

	return {
		people: [...userPeople, ...invitedPeople],
		programs: programRows.map((program) => ({
			name: program.name,
			color: program.color,
			archived: program.status === 'ARCHIVED'
		})),
		canManage,
		canGrant,
		grantable: allOrgPermissions.filter((permission) => hasOrgPermission(viewer, permission))
	};
};

export const actions: Actions = {
	invite: async ({ locals, request }) => {
		const actor = requireUser(locals);
		const form = await request.formData();
		const result = await invitePeople(actor, {
			emails: form.getAll('emails').map(String),
			role: String(form.get('role') ?? 'Reviewer'),
			orgPermissions: form.getAll('orgPermissions').map(String),
			programs: form.getAll('programs').map(String)
		});
		if (!result.ok) return fail(result.status, { error: result.error });
		return { invited: result.invited };
	},

	setOrgPermissions: async ({ locals, request }) => {
		const actor = requireUser(locals);
		const form = await request.formData();
		const result = await setUserOrgPermissions(
			actor,
			String(form.get('email') ?? ''),
			form.getAll('orgPermissions').map(String)
		);
		if (!result.ok) return fail(result.status, { error: result.error });
		return { success: true };
	},

	// the sweep runs in the background: the action returns as soon as it is queued
	syncSlack: async ({ locals }) => {
		const actor = requireUser(locals);
		if (!hasOrgPermission(actor, 'MANAGE_PEOPLE'))
			return fail(403, { error: 'You do not have permission to sync Slack channels.' });
		const users = await db.user.count({
			where: { memberships: { some: {} }, slackId: { not: null } }
		});
		if (!queueOrgChannelBackfill())
			return fail(400, { error: 'Slack is not configured on this instance.' });
		return { syncing: users };
	},

	remove: async ({ locals, request }) => {
		const actor = requireUser(locals);
		const form = await request.formData();
		const result = await removePerson(actor, String(form.get('email') ?? ''));
		if (!result.ok) return fail(result.status, { error: result.error });
		return { success: true };
	}
};
