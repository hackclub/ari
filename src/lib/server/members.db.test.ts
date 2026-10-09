import { afterAll, beforeAll, beforeEach, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import type { OrgPermission, ProgramPermission, Track } from '$lib/data';
import { removeMember, setMemberAccess, setMemberPermissions, setMemberTracks } from './members';

const prefix = `membersTest${Date.now()}${Math.floor(Math.random() * 1000000)}`;
const programId = `${prefix}Program`;
const actorId = `${prefix}Actor`;
const memberId = `${prefix}Member`;
const pocId = `${prefix}Poc`;
const outsiderId = `${prefix}Outsider`;
const emailOf = (id: string) => `${id.toLowerCase()}@example.com`;

function sessionFor(
	id: string,
	orgPermissions: OrgPermission[],
	membership?: { permissions?: ProgramPermission[]; tracks?: Track[]; isPoc?: boolean }
): App.SessionUser {
	return {
		id,
		email: emailOf(id),
		name: id,
		namePending: false,
		avatarColor: '#338eda',
		slackId: null,
		orgPermissions,
		memberships: membership
			? [
					{
						programId,
						permissions: membership.permissions ?? [],
						isPoc: membership.isPoc ?? false,
						tracks: membership.tracks ?? ['software', 'hardware']
					}
				]
			: []
	};
}
const manager = sessionFor(actorId, [], {
	permissions: ['MANAGE_REVIEWERS', 'SECOND_PASS', 'USE_VMS']
});
const narrowManager = sessionFor(actorId, [], {
	permissions: ['MANAGE_REVIEWERS'],
	tracks: ['software']
});
const operator = sessionFor(actorId, ['OPERATE_ALL_PROGRAMS']);
const poc = sessionFor(pocId, [], { isPoc: true, tracks: ['software'] });

const accessOf = (userId: string) =>
	db.membership.findUniqueOrThrow({
		where: { userId_programId: { userId, programId } },
		select: { tracks: true, permissions: true }
	});

const events = async () =>
	(
		await db.activityEvent.findMany({
			where: { programId },
			orderBy: { createdAt: 'asc' },
			select: { kind: true, actorId: true, text: true, meta: true }
		})
	).sort((first, second) => first.text.localeCompare(second.text));

beforeAll(async () => {
	await db.user.createMany({
		data: [actorId, memberId, pocId, outsiderId].map((id) => ({
			id,
			email: emailOf(id),
			name: id,
			avatarColor: '#338eda'
		}))
	});
	await db.program.create({ data: { id: programId, name: prefix, color: '#338eda' } });
});

beforeEach(async () => {
	await db.activityEvent.deleteMany({ where: { programId } });
	await db.membership.deleteMany({ where: { programId } });
	await db.membership.createMany({
		data: [
			{ userId: memberId, programId, tracks: ['software'], permissions: ['VIEW_REVIEWED'] },
			{ userId: pocId, programId, tracks: ['software'], permissions: [], isPoc: true },
			{ userId: actorId, programId, tracks: ['software'], permissions: ['MANAGE_REVIEWERS'] }
		]
	});
});

afterAll(async () => {
	await db.activityEvent.deleteMany({ where: { programId } });
	await db.program.deleteMany({ where: { id: programId } });
	await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
});

test('a combined change writes tracks and permissions with one event each', async () => {
	const result = await setMemberAccess(
		programId,
		manager,
		emailOf(memberId),
		['software', 'hardware'],
		['SECOND_PASS', 'USE_VMS']
	);
	expect(result).toEqual({ ok: true });
	expect(await accessOf(memberId)).toEqual({
		tracks: ['software', 'hardware'],
		permissions: ['SECOND_PASS', 'USE_VMS']
	});
	const email = emailOf(memberId);
	expect(await events()).toEqual([
		{
			kind: 'MEMBER',
			actorId: manager.id,
			text: `Set ${email} to 2 permissions`,
			meta: {
				op: 'permissions-changed',
				email,
				from: ['VIEW_REVIEWED'],
				to: ['SECOND_PASS', 'USE_VMS']
			}
		},
		{
			kind: 'MEMBER',
			actorId: manager.id,
			text: `Set ${email} tracks to software + hardware`,
			meta: { op: 'tracks-changed', email, from: ['software'], to: ['software', 'hardware'] }
		}
	]);
});

test('a combined change only logs the part that changed, and nothing when neither did', async () => {
	await setMemberAccess(programId, manager, emailOf(memberId), ['software'], []);
	expect(await accessOf(memberId)).toEqual({ tracks: ['software'], permissions: [] });
	expect((await events()).map((event) => event.text)).toEqual([
		`Set ${emailOf(memberId)} to no permissions`
	]);

	expect(await setMemberAccess(programId, manager, emailOf(memberId), ['software'], [])).toEqual({
		ok: true
	});
	expect(await events()).toHaveLength(1);
});

test('a refused combined change leaves both parts untouched', async () => {
	const before = await accessOf(memberId);
	expect(before).toEqual({ tracks: ['software'], permissions: ['VIEW_REVIEWED'] });

	// valid permissions, no tracks: the permissions must not land on their own
	expect(await setMemberAccess(programId, manager, emailOf(memberId), [], ['SECOND_PASS'])).toEqual(
		{ ok: false, status: 400, error: 'A reviewer needs at least one track.' }
	);
	expect(await accessOf(memberId)).toEqual(before);

	expect(
		await setMemberAccess(programId, manager, emailOf(pocId), ['hardware'], ['SECOND_PASS'])
	).toEqual({ ok: false, status: 403, error: 'Only an org operator can edit the program POC.' });
	expect(await accessOf(pocId)).toEqual({ tracks: ['software'], permissions: [] });

	expect(await setMemberAccess(programId, manager, emailOf(outsiderId), ['hardware'], [])).toEqual({
		ok: false,
		status: 404,
		error: 'Not a member of this program.'
	});
	expect(await setMemberAccess(programId, manager, '', ['hardware'], [])).toEqual({
		ok: false,
		status: 400,
		error: 'Email is required.'
	});
	expect(await events()).toEqual([]);
});

test('a tracks write that fails takes the permissions change down with it', async () => {
	// not a value of the enum, so the database write itself is what fails. an operator is
	// unscoped, so nothing before the write refuses it
	const invalid = ['NOT_A_TRACK' as Track];
	await expect(
		setMemberAccess(programId, operator, emailOf(memberId), invalid, ['SECOND_PASS'])
	).rejects.toThrow();
	expect(await accessOf(memberId)).toEqual({
		tracks: ['software'],
		permissions: ['VIEW_REVIEWED']
	});
	expect(await events()).toEqual([]);
});

test('an org operator may change the poc', async () => {
	expect(
		await setMemberAccess(programId, operator, emailOf(pocId), ['hardware'], ['SECOND_PASS'])
	).toEqual({ ok: true });
	expect(await accessOf(pocId)).toEqual({ tracks: ['hardware'], permissions: ['SECOND_PASS'] });
});

test('the single-part functions keep their rules and events', async () => {
	expect(await setMemberTracks(programId, manager, emailOf(memberId), [])).toEqual({
		ok: false,
		status: 400,
		error: 'A reviewer needs at least one track.'
	});
	expect(await setMemberTracks(programId, manager, emailOf(memberId), ['hardware'])).toEqual({
		ok: true
	});
	expect(await setMemberPermissions(programId, manager, emailOf(memberId), [])).toEqual({
		ok: true
	});
	expect(await accessOf(memberId)).toEqual({ tracks: ['hardware'], permissions: [] });
	expect((await events()).map((event) => event.text)).toEqual([
		`Set ${emailOf(memberId)} to no permissions`,
		`Set ${emailOf(memberId)} tracks to hardware`
	]);
	expect(await setMemberPermissions(programId, manager, emailOf(pocId), ['USE_VMS'])).toEqual({
		ok: false,
		status: 403,
		error: 'Only an org operator can edit the program POC.'
	});
});

test('a manager grants only the permissions they hold, and may revoke any', async () => {
	const refused = {
		ok: false,
		status: 403,
		error: 'You can only grant permissions you hold yourself.'
	};
	expect(
		await setMemberPermissions(programId, narrowManager, emailOf(memberId), ['SECOND_PASS'])
	).toEqual(refused);
	// an unheld permission the member already has is kept, not granted
	expect(
		await setMemberPermissions(programId, narrowManager, emailOf(memberId), [
			'VIEW_REVIEWED',
			'USE_VMS'
		])
	).toEqual(refused);
	expect(
		await setMemberPermissions(programId, narrowManager, emailOf(memberId), ['VIEW_REVIEWED'])
	).toEqual({ ok: true });
	expect(await setMemberPermissions(programId, narrowManager, emailOf(memberId), [])).toEqual({
		ok: true
	});
	expect(await accessOf(memberId)).toEqual({ tracks: ['software'], permissions: [] });
	expect(
		await setMemberPermissions(programId, manager, emailOf(memberId), ['SECOND_PASS', 'USE_VMS'])
	).toEqual({ ok: true });
	expect(
		await setMemberPermissions(programId, poc, emailOf(memberId), ['OVERRIDE_DECISIONS'])
	).toEqual({ ok: true });
	expect(
		await setMemberPermissions(programId, operator, emailOf(memberId), ['MANAGE_SETTINGS'])
	).toEqual({ ok: true });
	expect((await accessOf(memberId)).permissions).toEqual(['MANAGE_SETTINGS']);
});

test('tracks are assigned inside the actor’s own scope, unless they are unscoped', async () => {
	expect(await setMemberTracks(programId, narrowManager, emailOf(memberId), ['hardware'])).toEqual({
		ok: false,
		status: 403,
		error: 'You can only assign tracks inside your own track scope.'
	});
	expect(await accessOf(memberId)).toEqual({
		tracks: ['software'],
		permissions: ['VIEW_REVIEWED']
	});
	// the poc and an org operator are unscoped
	expect(await setMemberTracks(programId, poc, emailOf(memberId), ['hardware'])).toEqual({
		ok: true
	});
	// keeping a track outside the actor's scope is not assigning it
	expect(
		await setMemberTracks(programId, narrowManager, emailOf(memberId), ['software', 'hardware'])
	).toEqual({ ok: true });
	expect(await setMemberTracks(programId, operator, emailOf(memberId), ['software'])).toEqual({
		ok: true
	});
	expect((await accessOf(memberId)).tracks).toEqual(['software']);
});

test('nobody edits or removes their own membership, except an org operator', async () => {
	const own = emailOf(actorId);
	expect(await setMemberPermissions(programId, manager, own, [])).toEqual({
		ok: false,
		status: 403,
		error: "You can't change your own access."
	});
	expect(await setMemberTracks(programId, manager, own, ['software', 'hardware'])).toEqual({
		ok: false,
		status: 403,
		error: "You can't change your own access."
	});
	expect(await removeMember(programId, manager, own)).toEqual({
		ok: false,
		status: 400,
		error: "You can't remove yourself from the program."
	});
	expect(await accessOf(actorId)).toEqual({
		tracks: ['software'],
		permissions: ['MANAGE_REVIEWERS']
	});
	expect(await events()).toEqual([]);

	expect(await setMemberTracks(programId, operator, own, ['hardware'])).toEqual({ ok: true });
	expect((await accessOf(actorId)).tracks).toEqual(['hardware']);
	expect(await removeMember(programId, operator, own)).toEqual({ ok: true });
	expect(await db.membership.count({ where: { userId: actorId, programId } })).toBe(0);
});
