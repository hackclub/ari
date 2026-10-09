import { db } from '$lib/server/db';
import { hasOrgPermission } from '$lib/server/authz';
import { systemUserId } from '$lib/server/systemUser';
import { allOrgPermissions, allPermissions } from '$lib/data';
import {
	queueDeletedUserKicks,
	queueOrgChannelSync,
	queueReviewersChannelSync
} from '$lib/server/slackChannels';
import type { OrgPermission, ProgramPermission } from '$db';

export type PeopleResult<Data> =
	| ({ ok: true } & Data)
	| { ok: false; status: number; error: string };

const refuse = (status: number, error: string) => ({ ok: false as const, status, error });

export const parseOrgPermissions = (raw: string[]): OrgPermission[] =>
	allOrgPermissions.filter((permission) => raw.includes(permission));

const sameSet = (first: string[], second: string[]) =>
	[...first].sort().join(',') === [...second].sort().join(',');

export interface InviteInput {
	emails: string[];
	role: string;
	orgPermissions: string[];
	programs: string[];
}

async function addExistingUserToProgram(
	actor: App.SessionUser,
	existingId: string,
	email: string,
	programId: string,
	permissions: ProgramPermission[],
	label: string
) {
	const previous = await db.membership.findUnique({
		where: { userId_programId: { userId: existingId, programId } },
		select: { permissions: true }
	});
	await db.membership.upsert({
		where: { userId_programId: { userId: existingId, programId } },
		create: { userId: existingId, programId, permissions },
		update: { permissions }
	});
	// a signed-in user can never accept an invite at login again, so the membership consumes it
	await db.invite.updateMany({
		where: { email: { equals: email, mode: 'insensitive' }, programId, acceptedAt: null },
		data: { acceptedAt: new Date() }
	});
	if (!previous) {
		queueOrgChannelSync(existingId);
		queueReviewersChannelSync(programId, existingId, 'add');
		await db.activityEvent.create({
			data: {
				programId,
				kind: 'MEMBER',
				actorId: actor.id,
				text: `Added ${email} as ${label}`,
				meta: { op: 'added', email, role: label }
			}
		});
	} else if (!sameSet(previous.permissions, permissions)) {
		await db.activityEvent.create({
			data: {
				programId,
				kind: 'MEMBER',
				actorId: actor.id,
				text: `Changed ${email} to ${label}`,
				meta: { op: 'permissions-changed', email, to: permissions }
			}
		});
	}
}

export async function invitePeople(
	actor: App.SessionUser,
	input: InviteInput
): Promise<PeopleResult<{ invited: number }>> {
	if (!hasOrgPermission(actor, 'MANAGE_PEOPLE'))
		return refuse(403, 'You do not have permission to invite people.');

	const emails = input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean);
	const asOrganizer = input.role === 'Organizer';
	const permissions = asOrganizer ? allPermissions : [];
	const label = asOrganizer ? 'Organizer' : 'Reviewer';

	const orgPermissions = parseOrgPermissions(input.orgPermissions);
	if (orgPermissions.length > 0) {
		if (!hasOrgPermission(actor, 'GRANT_ORG_PERMS'))
			return refuse(403, 'You do not have permission to grant org permissions.');
		if (orgPermissions.some((permission) => !hasOrgPermission(actor, permission)))
			return refuse(403, 'You can only grant org permissions you hold yourself.');
	}

	const wanted = input.programs.map((name) => name.trim()).filter(Boolean);
	const programs = wanted.length
		? await db.program.findMany({ where: { name: { in: wanted } }, select: { id: true } })
		: [];
	const programIds = programs.map((program) => program.id);

	if (emails.length === 0) return refuse(400, 'Add at least one email.');

	for (const email of emails) {
		// user emails keep the identity provider's casing, and an exact match would stack an invite
		// the person can never accept
		const existing = await db.user.findFirst({
			where: { email: { equals: email, mode: 'insensitive' } }
		});
		if (existing?.id === systemUserId) continue;
		if (existing) {
			const self = email === actor.email.toLowerCase();
			// own email skipped: nobody changes their own org permissions on any grant path
			if (orgPermissions.length > 0 && !self) {
				const merged = allOrgPermissions.filter(
					(permission) =>
						existing.orgPermissions.includes(permission) || orgPermissions.includes(permission)
				);
				if (merged.length !== existing.orgPermissions.length) {
					await db.user.update({ where: { id: existing.id }, data: { orgPermissions: merged } });
				}
			}
			// own email skipped again for program seats: only someone who already runs every
			// program may seat themselves
			const canSeatSelf =
				hasOrgPermission(actor, 'OPERATE_ALL_PROGRAMS') ||
				hasOrgPermission(actor, 'MANAGE_PROGRAMS');
			if (self && !canSeatSelf) continue;
			for (const programId of programIds)
				await addExistingUserToProgram(actor, existing.id, email, programId, permissions, label);
		} else if (programIds.length) {
			for (const programId of programIds) {
				const duplicate = await db.invite.findFirst({
					where: { email, programId, acceptedAt: null }
				});
				if (duplicate) continue;
				await db.invite.create({ data: { email, programId, permissions, orgPermissions } });
				await db.activityEvent.create({
					data: {
						programId,
						kind: 'MEMBER',
						actorId: actor.id,
						text: `Invited ${email} as ${label}`,
						meta: { op: 'invited', email, role: label }
					}
				});
			}
		} else {
			const duplicate = await db.invite.findFirst({
				where: { email, programId: null, acceptedAt: null }
			});
			if (!duplicate) await db.invite.create({ data: { email, orgPermissions } });
		}
	}

	return { ok: true, invited: emails.length };
}

// revoking is unrestricted: taking a permission away is not an escalation
export async function setUserOrgPermissions(
	actor: App.SessionUser,
	rawEmail: string,
	rawPermissions: string[]
): Promise<PeopleResult<object>> {
	if (!hasOrgPermission(actor, 'GRANT_ORG_PERMS'))
		return refuse(403, 'You do not have permission to grant org permissions.');
	const email = rawEmail.trim().toLowerCase();
	const permissions = parseOrgPermissions(rawPermissions);
	if (!email) return refuse(400, 'No email provided.');
	if (email === actor.email.toLowerCase())
		return refuse(400, "You can't change your own org permissions.");

	const user = await db.user.findFirst({
		where: { email: { equals: email, mode: 'insensitive' } },
		select: { id: true, orgPermissions: true }
	});
	if (!user) return refuse(404, 'No account with that email has signed in yet.');
	if (user.id === systemUserId)
		return refuse(400, "The system account's permissions can't change.");

	const added = permissions.filter((permission) => !user.orgPermissions.includes(permission));
	if (added.some((permission) => !hasOrgPermission(actor, permission)))
		return refuse(403, 'You can only grant org permissions you hold yourself.');
	if (sameSet(user.orgPermissions, permissions)) return { ok: true };
	await db.user.update({ where: { id: user.id }, data: { orgPermissions: permissions } });
	return { ok: true };
}

export async function removePerson(
	actor: App.SessionUser,
	rawEmail: string
): Promise<PeopleResult<object>> {
	if (!hasOrgPermission(actor, 'MANAGE_PEOPLE'))
		return refuse(403, 'You do not have permission to remove people.');
	const email = rawEmail.trim().toLowerCase();
	if (!email) return refuse(400, 'No email provided.');
	if (email === actor.email.toLowerCase()) return refuse(400, "You can't remove yourself.");

	// memberships are read before the cascade wipes them, so each program's log records the removal
	const user = await db.user.findFirst({
		where: { email: { equals: email, mode: 'insensitive' } },
		select: {
			id: true,
			slackId: true,
			orgPermissions: true,
			memberships: { select: { programId: true, permissions: true, isPoc: true } }
		}
	});
	// deleting the system account would cascade away the automated decisions it anchors
	if (user?.id === systemUserId) return refuse(400, "The system account can't be removed.");
	// removing a holder is the inverse of a grant, so it takes the granting tier
	if (user && user.orgPermissions.length > 0) {
		if (!hasOrgPermission(actor, 'GRANT_ORG_PERMS'))
			return refuse(403, 'You do not have permission to remove people who hold org permissions.');
		if (user.orgPermissions.some((permission) => !hasOrgPermission(actor, permission)))
			return refuse(403, 'You can only remove people whose org permissions you hold yourself.');
	}

	const memberships = user?.memberships ?? [];
	// one transaction, so a crash cannot leave the deletion without its audit rows
	try {
		await db.$transaction([
			db.user.deleteMany({ where: { email: { equals: email, mode: 'insensitive' } } }),
			db.invite.deleteMany({ where: { email: { equals: email, mode: 'insensitive' } } }),
			...memberships.map((membership) =>
				db.activityEvent.create({
					data: {
						programId: membership.programId,
						kind: 'MEMBER' as const,
						actorId: actor.id,
						text: `Removed ${email}`,
						meta: {
							op: 'removed',
							email,
							role: membership.isPoc || membership.permissions.length > 0 ? 'Organizer' : 'Reviewer'
						}
					}
				})
			)
		]);
	} catch (error) {
		// reviews keep their reviewer: the foreign key refuses the delete and nothing is written
		if ((error as { code?: string }).code !== 'P2003') throw error;
		return refuse(
			409,
			'This person has reviewed ships, so their account cannot be removed. Remove their program memberships instead.'
		);
	}
	queueDeletedUserKicks(
		user?.slackId ?? null,
		memberships.map((membership) => membership.programId)
	);
	return { ok: true };
}
