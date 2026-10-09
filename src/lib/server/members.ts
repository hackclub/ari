import { db } from '$lib/server/db';
import {
	effectiveProgramPermissions,
	hasOrgPermission,
	trackAllowed,
	trackScope
} from '$lib/server/authz';
import { allPermissions, allTracks } from '$lib/data';
import { systemUserId } from '$lib/server/systemUser';
import { queueOrgChannelSync, queueReviewersChannelSync } from '$lib/server/slackChannels';
import type { ProgramPermission, Track } from '$db';

export type MemberResult = { ok: true } | { ok: false; status: number; error: string };
const refuse = (status: number, error: string): MemberResult => ({ ok: false, status, error });

export const parseTracks = (raw: string[]): Track[] =>
	allTracks.filter((track) => raw.includes(track));

export const parsePermissions = (raw: string[]): ProgramPermission[] =>
	allPermissions.filter((permission) => raw.includes(permission));

export const permSummary = (permissions: ProgramPermission[]): string =>
	permissions.length === 0
		? 'no permissions'
		: `${permissions.length} permission${permissions.length === 1 ? '' : 's'}`;

export function logMember(
	programId: string,
	actorId: string,
	operation: 'added' | 'invited' | 'removed',
	email: string,
	detail?: string
) {
	const verb = operation === 'added' ? 'Added' : operation === 'invited' ? 'Invited' : 'Removed';
	const suffix = operation === 'removed' || !detail ? '' : ` with ${detail}`;
	return db.activityEvent.create({
		data: {
			programId,
			kind: 'MEMBER',
			actorId,
			text: `${verb} ${email}${suffix}`,
			meta: { op: operation, email, detail: detail ?? null }
		}
	});
}

const sameSet = (first: string[], second: string[]) =>
	[...first].sort().join(',') === [...second].sort().join(',');

interface AccessChange {
	tracks?: Track[];
	permissions?: ProgramPermission[];
}

// every refusal comes before the first write, and the writes share one transaction, so a change
// to both tracks and permissions lands whole or not at all
async function applyAccess(
	programId: string,
	actor: App.SessionUser,
	email: string,
	change: AccessChange
): Promise<MemberResult> {
	if (!email) return refuse(400, 'Email is required.');
	// an empty scope would silently lock them out of the whole program
	if (change.tracks && !change.tracks.length) {
		return refuse(400, 'A reviewer needs at least one track.');
	}

	const user = await db.user.findUnique({ where: { email } });
	if (!user) return refuse(404, 'No such user.');
	if (user.id === actor.id && !hasOrgPermission(actor, 'OPERATE_ALL_PROGRAMS')) {
		return refuse(403, "You can't change your own access.");
	}
	const existing = await db.membership.findUnique({
		where: { userId_programId: { userId: user.id, programId } },
		select: { tracks: true, permissions: true, isPoc: true }
	});
	if (!existing) return refuse(404, 'Not a member of this program.');
	if (existing.isPoc && !hasOrgPermission(actor, 'OPERATE_ALL_PROGRAMS')) {
		return refuse(403, 'Only an org operator can edit the program POC.');
	}
	// revoking is unrestricted: taking a permission or a track away is not an escalation
	const held = effectiveProgramPermissions(actor, programId);
	const addedPermissions = (change.permissions ?? []).filter(
		(permission) => !existing.permissions.includes(permission)
	);
	if (addedPermissions.some((permission) => !held.includes(permission))) {
		return refuse(403, 'You can only grant permissions you hold yourself.');
	}
	const scope = trackScope(actor, programId);
	const addedTracks = (change.tracks ?? []).filter((track) => !existing.tracks.includes(track));
	if (addedTracks.some((track) => !trackAllowed(scope, track))) {
		return refuse(403, 'You can only assign tracks inside your own track scope.');
	}

	const tracks =
		change.tracks && !sameSet(existing.tracks, change.tracks) ? change.tracks : undefined;
	const permissions =
		change.permissions && !sameSet(existing.permissions, change.permissions)
			? change.permissions
			: undefined;
	if (!tracks && !permissions) return { ok: true };

	const event = (text: string, meta: Record<string, unknown>) =>
		db.activityEvent.create({
			data: { programId, kind: 'MEMBER', actorId: actor.id, text, meta: { ...meta, email } }
		});
	await db.$transaction([
		db.membership.updateMany({
			where: { userId: user.id, programId },
			data: { ...(tracks ? { tracks } : {}), ...(permissions ? { permissions } : {}) }
		}),
		...(tracks
			? [
					event(`Set ${email} tracks to ${tracks.join(' + ')}`, {
						op: 'tracks-changed',
						from: existing.tracks,
						to: tracks
					})
				]
			: []),
		...(permissions
			? [
					event(`Set ${email} to ${permSummary(permissions)}`, {
						op: 'permissions-changed',
						from: existing.permissions,
						to: permissions
					})
				]
			: [])
	]);
	return { ok: true };
}

export const setMemberTracks = (
	programId: string,
	actor: App.SessionUser,
	email: string,
	tracks: Track[]
): Promise<MemberResult> => applyAccess(programId, actor, email, { tracks });

export const setMemberPermissions = (
	programId: string,
	actor: App.SessionUser,
	email: string,
	permissions: ProgramPermission[]
): Promise<MemberResult> => applyAccess(programId, actor, email, { permissions });

export const setMemberAccess = (
	programId: string,
	actor: App.SessionUser,
	email: string,
	tracks: Track[],
	permissions: ProgramPermission[]
): Promise<MemberResult> => applyAccess(programId, actor, email, { tracks, permissions });

export async function removeMember(
	programId: string,
	actor: App.SessionUser,
	email: string
): Promise<MemberResult> {
	if (!email) return refuse(400, 'Email is required.');

	// case-insensitive: invites are stored lowercased, a user row keeps the provider's case
	const revokeInvites = () =>
		db.invite.deleteMany({
			where: { email: { equals: email, mode: 'insensitive' }, programId, acceptedAt: null }
		});
	const user = await db.user.findFirst({
		where: { email: { equals: email, mode: 'insensitive' } }
	});
	if (!user) {
		// invited but never signed in: removing means revoking the pending invite
		const { count } = await revokeInvites();
		if (count > 0) await logMember(programId, actor.id, 'removed', email);
		return { ok: true };
	}
	if (user.id === actor.id && !hasOrgPermission(actor, 'OPERATE_ALL_PROGRAMS')) {
		return refuse(400, "You can't remove yourself from the program.");
	}
	if (user.id === systemUserId) return refuse(400, "The system account can't be removed.");
	const existing = await db.membership.findUnique({
		where: { userId_programId: { userId: user.id, programId } },
		select: { isPoc: true }
	});
	if (existing?.isPoc && !hasOrgPermission(actor, 'OPERATE_ALL_PROGRAMS')) {
		return refuse(403, 'Only an org operator can remove the program POC.');
	}
	const { count } = await db.membership.deleteMany({ where: { userId: user.id, programId } });
	// a signed-in user can still hold a pending invite that predates their first login
	const invites = await revokeInvites();
	if (count > 0) {
		queueReviewersChannelSync(programId, user.id, 'remove');
		queueOrgChannelSync(user.id);
	}
	if (count > 0 || invites.count > 0) await logMember(programId, actor.id, 'removed', email);
	return { ok: true };
}
