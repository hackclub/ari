import { afterAll, beforeAll, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { allOrgPermissions, allPermissions, type OrgPermission } from '$lib/data';
import { systemUserId } from '$lib/server/systemUser';
import { invitePeople, removePerson, setUserOrgPermissions } from './people';

const prefix = `peopleTest${Date.now()}${Math.floor(Math.random() * 1000000)}`;
const lower = prefix.toLowerCase();
const programId = `${prefix}Program`;
const programName = `${prefix} program`;
const emailFor = (name: string) => `${lower}.${name}@example.com`;

function actorWith(name: string, orgPermissions: OrgPermission[]): App.SessionUser {
	return {
		id: `${prefix}${name}`,
		email: emailFor(name),
		name,
		namePending: false,
		avatarColor: '#338eda',
		slackId: null,
		orgPermissions,
		memberships: []
	};
}

const admin = actorWith('admin', allOrgPermissions);
const granter = actorWith('granter', ['GRANT_ORG_PERMS', 'VIEW_WEBHOOK_LOGS']);
const manager = actorWith('manager', ['MANAGE_PEOPLE']);
const programManager = actorWith('programManager', ['MANAGE_PEOPLE', 'MANAGE_PROGRAMS']);
const outsider = actorWith('outsider', []);
const targetId = `${prefix}target`;
const holderId = `${prefix}holder`;

const orgPermissionsOf = async (id: string) =>
	(await db.user.findUniqueOrThrow({ where: { id }, select: { orgPermissions: true } }))
		.orgPermissions;

const invitesFor = (email: string) =>
	db.invite.findMany({ where: { email }, orderBy: { createdAt: 'asc' } });

beforeAll(async () => {
	await db.user.createMany({
		data: [
			...[admin, granter, manager, programManager, outsider].map((actor) => ({
				id: actor.id,
				email: actor.email,
				name: actor.name,
				avatarColor: actor.avatarColor,
				orgPermissions: actor.orgPermissions
			})),
			// stored with the identity provider's casing, looked up lowercased
			{ id: targetId, email: emailFor('Target'), name: 'Target', avatarColor: '#338eda' },
			{
				id: holderId,
				email: emailFor('holder'),
				name: 'Holder',
				avatarColor: '#338eda',
				orgPermissions: ['VIEW_WEBHOOK_LOGS' as const]
			}
		]
	});
	await db.program.create({ data: { id: programId, name: programName, color: '#338eda' } });
});

afterAll(async () => {
	await db.activityEvent.deleteMany({ where: { programId } });
	await db.invite.deleteMany({ where: { email: { startsWith: lower } } });
	await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
	await db.program.deleteMany({ where: { id: programId } });
});

test('org permissions need GRANT_ORG_PERMS', async () => {
	const result = await setUserOrgPermissions(manager, emailFor('target'), ['MANAGE_PEOPLE']);
	expect(result).toEqual({
		ok: false,
		status: 403,
		error: 'You do not have permission to grant org permissions.'
	});
	expect(await orgPermissionsOf(targetId)).toEqual([]);
});

test('nobody edits their own org permissions, in any casing', async () => {
	for (const email of [admin.email, admin.email.toUpperCase(), `  ${admin.email} `]) {
		const result = await setUserOrgPermissions(admin, email, []);
		expect(result).toEqual({
			ok: false,
			status: 400,
			error: "You can't change your own org permissions."
		});
	}
	expect((await orgPermissionsOf(admin.id)).sort()).toEqual([...allOrgPermissions].sort());
});

test('a permission the actor does not hold cannot be granted', async () => {
	const result = await setUserOrgPermissions(granter, emailFor('target'), [
		'VIEW_WEBHOOK_LOGS',
		'MANAGE_MCP'
	]);
	expect(result).toEqual({
		ok: false,
		status: 403,
		error: 'You can only grant org permissions you hold yourself.'
	});
	expect(await orgPermissionsOf(targetId)).toEqual([]);
});

test('a held permission is granted, and unknown values are dropped', async () => {
	const result = await setUserOrgPermissions(granter, emailFor('target'), [
		'VIEW_WEBHOOK_LOGS',
		'NOT_A_PERMISSION'
	]);
	expect(result).toEqual({ ok: true });
	expect(await orgPermissionsOf(targetId)).toEqual(['VIEW_WEBHOOK_LOGS']);
});

test('revoking a permission the actor does not hold is allowed', async () => {
	await db.user.update({
		where: { id: targetId },
		data: { orgPermissions: ['VIEW_WEBHOOK_LOGS', 'MANAGE_MCP'] }
	});
	// keeping MANAGE_MCP is not adding it
	expect(
		await setUserOrgPermissions(granter, emailFor('target'), ['VIEW_WEBHOOK_LOGS', 'MANAGE_MCP'])
	).toEqual({ ok: true });
	expect(await setUserOrgPermissions(granter, emailFor('target'), [])).toEqual({ ok: true });
	expect(await orgPermissionsOf(targetId)).toEqual([]);
});

test('an unknown email is a 404', async () => {
	const result = await setUserOrgPermissions(admin, emailFor('nobody'), []);
	expect(result).toMatchObject({ ok: false, status: 404 });
});

test('the system user cannot be edited, removed or invited', async () => {
	const system = await db.user.findUnique({ where: { id: systemUserId } });
	if (!system) return;
	const before = { orgPermissions: system.orgPermissions };

	expect(await setUserOrgPermissions(admin, system.email, ['MANAGE_PEOPLE'])).toEqual({
		ok: false,
		status: 400,
		error: "The system account's permissions can't change."
	});
	expect(await removePerson(admin, system.email)).toEqual({
		ok: false,
		status: 400,
		error: "The system account can't be removed."
	});
	expect(
		await invitePeople(admin, {
			emails: [system.email],
			role: 'Organizer',
			orgPermissions: ['MANAGE_PEOPLE'],
			programs: [programName]
		})
	).toEqual({ ok: true, invited: 1 });

	const after = await db.user.findUniqueOrThrow({
		where: { id: systemUserId },
		include: { memberships: { where: { programId } } }
	});
	expect(after.orgPermissions).toEqual(before.orgPermissions);
	expect(after.memberships).toEqual([]);
	expect(await invitesFor(system.email.toLowerCase())).toEqual([]);
});

test('inviting needs MANAGE_PEOPLE and at least one email', async () => {
	const input = { emails: [emailFor('new')], role: 'Reviewer', orgPermissions: [], programs: [] };
	expect(await invitePeople(granter, input)).toEqual({
		ok: false,
		status: 403,
		error: 'You do not have permission to invite people.'
	});
	expect(await invitePeople(manager, { ...input, emails: ['  ', ''] })).toEqual({
		ok: false,
		status: 400,
		error: 'Add at least one email.'
	});
	expect(await invitesFor(emailFor('new'))).toEqual([]);
});

test('org permissions on an invite need GRANT_ORG_PERMS and only held ones', async () => {
	const input = { emails: [emailFor('new')], role: 'Reviewer', programs: [] };
	expect(await invitePeople(manager, { ...input, orgPermissions: ['MANAGE_PEOPLE'] })).toEqual({
		ok: false,
		status: 403,
		error: 'You do not have permission to grant org permissions.'
	});
	const both = actorWith('both', ['MANAGE_PEOPLE', 'GRANT_ORG_PERMS']);
	expect(await invitePeople(both, { ...input, orgPermissions: ['MANAGE_MCP'] })).toEqual({
		ok: false,
		status: 403,
		error: 'You can only grant org permissions you hold yourself.'
	});
	expect(await invitesFor(emailFor('new'))).toEqual([]);
});

test('invites are lowercased and de-duplicated per program', async () => {
	const input = {
		emails: [` ${emailFor('New').toUpperCase()} `, emailFor('new')],
		role: 'Organizer',
		orgPermissions: ['VIEW_WEBHOOK_LOGS'],
		programs: [programName]
	};
	expect(await invitePeople(admin, input)).toEqual({ ok: true, invited: 2 });
	expect(await invitePeople(admin, input)).toEqual({ ok: true, invited: 2 });

	const invites = await invitesFor(emailFor('new'));
	expect(invites).toHaveLength(1);
	expect(invites[0]).toMatchObject({
		email: emailFor('new'),
		programId,
		orgPermissions: ['VIEW_WEBHOOK_LOGS'],
		acceptedAt: null
	});
	expect([...invites[0].permissions].sort()).toEqual([...allPermissions].sort());
	expect(
		await db.activityEvent.count({
			where: { programId, text: `Invited ${emailFor('new')} as Organizer` }
		})
	).toBe(1);

	// an org-level invite is a separate, also de-duplicated, row
	const orgLevel = {
		emails: [emailFor('new')],
		role: 'Reviewer',
		orgPermissions: [],
		programs: []
	};
	await invitePeople(admin, orgLevel);
	await invitePeople(admin, orgLevel);
	const afterOrgLevel = await invitesFor(emailFor('new'));
	expect(afterOrgLevel.map((invite) => invite.programId)).toEqual([programId, null]);
});

test('inviting an existing user adds the membership and consumes their pending invite', async () => {
	await db.invite.create({ data: { email: emailFor('target'), programId } });
	const result = await invitePeople(admin, {
		emails: [emailFor('target')],
		role: 'Reviewer',
		orgPermissions: ['VIEW_WEBHOOK_LOGS'],
		programs: [programName]
	});
	expect(result).toEqual({ ok: true, invited: 1 });

	const membership = await db.membership.findUnique({
		where: { userId_programId: { userId: targetId, programId } }
	});
	expect(membership?.permissions).toEqual([]);
	expect(await orgPermissionsOf(targetId)).toEqual(['VIEW_WEBHOOK_LOGS']);
	const invites = await invitesFor(emailFor('target'));
	expect(invites).toHaveLength(1);
	expect(invites[0].acceptedAt).not.toBeNull();
});

test('an invite never changes the inviter’s own org permissions', async () => {
	await db.user.update({ where: { id: granter.id }, data: { orgPermissions: ['MANAGE_PEOPLE'] } });
	const both = { ...granter, orgPermissions: allOrgPermissions };
	expect(
		await invitePeople(both, {
			emails: [granter.email],
			role: 'Reviewer',
			orgPermissions: ['MANAGE_MCP'],
			programs: []
		})
	).toEqual({ ok: true, invited: 1 });
	expect(await orgPermissionsOf(granter.id)).toEqual(['MANAGE_PEOPLE']);
});

test('removing needs MANAGE_PEOPLE and never removes yourself', async () => {
	expect(await removePerson(granter, emailFor('target'))).toEqual({
		ok: false,
		status: 403,
		error: 'You do not have permission to remove people.'
	});
	expect(await removePerson(outsider, emailFor('target'))).toMatchObject({ status: 403 });
	expect(await removePerson(manager, manager.email.toUpperCase())).toEqual({
		ok: false,
		status: 400,
		error: "You can't remove yourself."
	});
	expect(await db.user.count({ where: { id: { in: [targetId, manager.id] } } })).toBe(2);
});

test('removing a user deletes their sessions, memberships and invites and logs it', async () => {
	await db.session.create({
		data: {
			id: `${prefix}Session`,
			userId: targetId,
			expiresAt: new Date(Date.now() + 3600000) // 1 hour: 60 * 60 * 1000
		}
	});
	await db.invite.create({ data: { email: emailFor('target') } });
	expect(await db.membership.count({ where: { userId: targetId } })).toBe(1);

	// the target was granted an org permission above, so the plain manager no longer qualifies
	expect(await removePerson(manager, emailFor('TARGET'))).toMatchObject({ status: 403 });
	expect(await removePerson(admin, emailFor('TARGET'))).toEqual({ ok: true });

	expect(await db.user.count({ where: { id: targetId } })).toBe(0);
	expect(await db.session.count({ where: { userId: targetId } })).toBe(0);
	expect(await db.membership.count({ where: { userId: targetId } })).toBe(0);
	expect(await invitesFor(emailFor('target'))).toEqual([]);
	const events = await db.activityEvent.findMany({
		where: { programId, text: `Removed ${emailFor('target')}` }
	});
	expect(events).toHaveLength(1);
	expect(events[0]).toMatchObject({
		kind: 'MEMBER',
		actorId: admin.id,
		meta: { op: 'removed', email: emailFor('target'), role: 'Reviewer' }
	});
});

test('removing an email with only a pending invite revokes the invite', async () => {
	expect(await invitesFor(emailFor('new'))).toHaveLength(2);
	expect(await removePerson(manager, emailFor('new'))).toEqual({ ok: true });
	expect(await invitesFor(emailFor('new'))).toEqual([]);
});

test('an invite never seats the inviter on a program, unless they run programs', async () => {
	const input = {
		emails: [manager.email],
		role: 'Organizer',
		orgPermissions: [],
		programs: [programName]
	};
	expect(await invitePeople(manager, input)).toEqual({ ok: true, invited: 1 });
	expect(await db.membership.count({ where: { userId: manager.id, programId } })).toBe(0);
	expect(await invitesFor(manager.email)).toEqual([]);

	expect(await invitePeople(programManager, { ...input, emails: [programManager.email] })).toEqual({
		ok: true,
		invited: 1
	});
	expect(await db.membership.count({ where: { userId: programManager.id, programId } })).toBe(1);
});

test('removing someone who holds org permissions takes the granting tier', async () => {
	expect(await removePerson(manager, emailFor('holder'))).toEqual({
		ok: false,
		status: 403,
		error: 'You do not have permission to remove people who hold org permissions.'
	});
	const grantsOthers = actorWith('grantsOthers', [
		'MANAGE_PEOPLE',
		'GRANT_ORG_PERMS',
		'MANAGE_MCP'
	]);
	expect(await removePerson(grantsOthers, emailFor('holder'))).toEqual({
		ok: false,
		status: 403,
		error: 'You can only remove people whose org permissions you hold yourself.'
	});
	expect(await db.user.count({ where: { id: holderId } })).toBe(1);

	const grantsLogs = actorWith('grantsLogs', [
		'MANAGE_PEOPLE',
		'GRANT_ORG_PERMS',
		'VIEW_WEBHOOK_LOGS'
	]);
	expect(await removePerson(grantsLogs, emailFor('holder'))).toEqual({ ok: true });
	expect(await db.user.count({ where: { id: holderId } })).toBe(0);
});
