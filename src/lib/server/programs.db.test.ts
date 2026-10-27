import { afterAll, beforeAll, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { allOrgPermissions, allPermissions, type OrgPermission } from '$lib/data';
import { load as loadProgramList } from '../../routes/programs/+page.server';
import { createProgram, setPoc, updateProgram, type CreateProgramInput } from './programs';
import { archiveProgram, reingestProgram, unarchiveProgram } from './programStatus';

const prefix = `programsTest${Date.now()}${Math.floor(Math.random() * 1000000)}`;
const lower = prefix.toLowerCase();
const emailFor = (name: string) => `${lower}.${name.toLowerCase()}@example.com`;
const savedEnv = { slack: process.env.SLACK_BOT_TOKEN, webhooks: process.env.WEBHOOKS_URL };

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

const manager = actorWith('manager', ['MANAGE_PROGRAMS']);
const creator = actorWith('creator', ['CREATE_PROGRAMS']);
const outsider = actorWith(
	'outsider',
	allOrgPermissions.filter(
		(permission) => permission !== 'MANAGE_PROGRAMS' && permission !== 'CREATE_PROGRAMS'
	)
);
const firstLead = actorWith('firstLead', []);
const secondLead = actorWith('secondLead', []);
const bystander = actorWith('bystander', []);

const inputFor = (
	name: string,
	overrides: Partial<CreateProgramInput> = {}
): CreateProgramInput => ({
	name: `${prefix} ${name}`,
	accent: '#33d6a6',
	evidence: ['commits', 'devlog', 'nonsense'],
	allowVms: false,
	secondPass: false,
	organizers: [],
	poc: '',
	reviewersChannel: 'C0123ABCDEF',
	trackingStartsAt: '2026-09-01',
	cantReviewOwn: false,
	allowDeflation: true,
	hoursJustification: true,
	secondPassApproved: true,
	secondPassChanges: true,
	secondPassRejected: true,
	secondPassOrganizerBypass: true,
	priorityReview: false,
	reviewerReauth: false,
	reviewerReauthTtlMinutes: '60',
	reviewGoal: '50',
	stepValues: {},
	...overrides
});

async function created(actor: App.SessionUser, input: CreateProgramInput): Promise<string> {
	const result = await createProgram(actor, input);
	if (!result.ok) throw new Error(result.error);
	return result.id;
}

const pocsOf = async (programId: string) =>
	(
		await db.membership.findMany({ where: { programId, isPoc: true }, select: { userId: true } })
	).map((membership) => membership.userId);

const updateInput = (programId: string, organizers: App.SessionUser[], poc: string) => ({
	programId,
	name: `${prefix} people`,
	accent: '',
	evidence: ['commits'],
	allowVms: false,
	secondPass: false,
	organizers: organizers.map((organizer) => organizer.email),
	poc
});

const refused = { ok: false as const, status: 403, error: 'You do not have permission to do this' };

beforeAll(async () => {
	process.env.SLACK_BOT_TOKEN = '';
	process.env.WEBHOOKS_URL = '';
	await db.user.createMany({
		data: [manager, creator, outsider, firstLead, secondLead, bystander].map((actor) => ({
			id: actor.id,
			// stored with the identity provider's casing, looked up lowercased
			email: actor === firstLead ? `${lower}.FirstLead@example.com` : actor.email,
			name: actor.name,
			avatarColor: actor.avatarColor,
			orgPermissions: actor.orgPermissions
		}))
	});
});

afterAll(async () => {
	const programs = await db.program.findMany({
		where: { name: { startsWith: prefix } },
		select: { id: true }
	});
	const programIds = programs.map((program) => program.id);
	await db.activityEvent.deleteMany({ where: { programId: { in: programIds } } });
	await db.invite.deleteMany({ where: { email: { startsWith: lower } } });
	await db.program.deleteMany({ where: { id: { in: programIds } } });
	await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
	process.env.SLACK_BOT_TOKEN = savedEnv.slack;
	process.env.WEBHOOKS_URL = savedEnv.webhooks;
});

test('creating needs CREATE_PROGRAMS, which MANAGE_PROGRAMS implies', async () => {
	expect(await createProgram(outsider, inputFor('refused'))).toEqual(refused);
	expect(await db.program.count({ where: { name: `${prefix} refused` } })).toBe(0);
	expect((await createProgram(creator, inputFor('byCreator'))).ok).toBe(true);
	expect((await createProgram(manager, inputFor('byManager'))).ok).toBe(true);
});

test('create writes the program, its webhook secret and its audit event, and nothing else', async () => {
	const programId = await created(
		manager,
		inputFor('written', {
			organizers: [firstLead.email, emailFor('newcomer')],
			poc: firstLead.email,
			secondPass: true,
			secondPassChanges: false,
			cantReviewOwn: true,
			priorityReview: true,
			reviewGoal: '12'
		})
	);
	const program = await db.program.findUniqueOrThrow({
		where: { id: programId },
		include: {
			webhookSecrets: true,
			memberships: true,
			_count: { select: { flagRules: true, checklist: true, snippets: true } }
		}
	});
	expect(program).toMatchObject({
		name: `${prefix} written`,
		color: '#33d6a6',
		status: 'ACTIVE',
		accepts: ['commits', 'devlog'],
		allowVms: false,
		secondPass: true,
		secondPassApproved: true,
		secondPassChanges: false,
		secondPassRejected: true,
		secondPassOrganizerBypass: true,
		reviewersChannelId: 'C0123ABCDEF',
		trackingStartsAt: new Date('2026-09-01T00:00:00Z'),
		reviewersCannotReviewOwnProjects: true,
		allowDeflation: true,
		hoursJustification: true,
		priorityReview: true,
		reviewerReauth: false,
		reviewerReauthTtlMinutes: 60,
		weeklyReviewGoal: 12,
		screenIdentity: true,
		screenHackatime: true
	});
	expect(program.priorityReviewToken).toMatch(/^[\w-]{32}$/); // 32 characters: 24 bytes as base64url
	expect(program.webhookSecrets).toHaveLength(1);
	// the old create seeds no checklist or snippets, and the public build enables no flag rules
	expect(program._count).toEqual({ flagRules: 0, checklist: 0, snippets: 0 });
	expect(program.memberships).toHaveLength(1);
	expect(program.memberships[0]).toMatchObject({ userId: firstLead.id, isPoc: true });
	expect([...program.memberships[0].permissions].sort()).toEqual([...allPermissions].sort());

	const invites = await db.invite.findMany({ where: { programId } });
	expect(invites.map((invite) => invite.email)).toEqual([emailFor('newcomer')]);
	expect([...invites[0].permissions].sort()).toEqual([...allPermissions].sort());

	const events = await db.activityEvent.findMany({ where: { programId } });
	expect(events).toHaveLength(1);
	expect(events[0]).toMatchObject({
		kind: 'SETTINGS',
		actorId: manager.id,
		text: `Program ${prefix} written created`,
		meta: {
			event: 'program_created',
			name: `${prefix} written`,
			accepts: ['commits', 'devlog'],
			organizers: [firstLead.email, emailFor('newcomer')],
			reviewersChannelId: 'C0123ABCDEF',
			trackingStartsAt: '2026-09-01',
			flags: []
		}
	});
});

test('create refuses the same inputs the wizard blocks', async () => {
	const attempt = (overrides: Partial<CreateProgramInput>) =>
		createProgram(manager, inputFor('invalid', overrides));
	expect(await attempt({ name: '  ' })).toMatchObject({
		status: 400,
		error: 'A program name is required.'
	});
	expect(await attempt({ reviewersChannel: 'general' })).toMatchObject({ status: 400 });
	expect(await attempt({ trackingStartsAt: '' })).toMatchObject({
		status: 400,
		error: 'A tracking start date is required.'
	});
	expect(await attempt({ trackingStartsAt: 'someday' })).toMatchObject({
		error: 'Tracking start must be a valid date.'
	});
	expect(await attempt({ reviewerReauth: true, reviewerReauthTtlMinutes: '0' })).toMatchObject({
		error: 'Re-auth inactivity timeout must be between 1 and 100000 minutes.'
	});
	expect(await attempt({ reviewGoal: '2.5' })).toMatchObject({
		error: 'Weekly review goal must be between 1 and 10000.'
	});
	expect(await db.program.count({ where: { name: `${prefix} invalid` } })).toBe(0);
});

test('the create-only tier is pinned as organizer and poc and cannot pick the privileged switches', async () => {
	expect(await createProgram(creator, inputFor('creatorVms', { allowVms: true }))).toEqual({
		ok: false,
		status: 403,
		error: 'Only people who can manage programs can turn on reviewer VMs.'
	});
	expect(await db.program.count({ where: { name: `${prefix} creatorVms` } })).toBe(0);

	const programId = await created(
		creator,
		inputFor('pinned', {
			organizers: [secondLead.email],
			poc: secondLead.email,
			hoursJustification: false
		})
	);
	expect(await pocsOf(programId)).toEqual([creator.id]);
	const members = await db.membership.findMany({ where: { programId }, select: { userId: true } });
	expect(members.map((member) => member.userId).sort()).toEqual([creator.id, secondLead.id].sort());
	const program = await db.program.findUniqueOrThrow({ where: { id: programId } });
	expect(program.hoursJustification).toBe(true);

	const managed = await created(
		manager,
		inputFor('managerVms', { allowVms: true, hoursJustification: false })
	);
	expect(await db.program.findUniqueOrThrow({ where: { id: managed } })).toMatchObject({
		allowVms: true,
		hoursJustification: false
	});
});

test('editing, archiving, restoring and re-ingesting need MANAGE_PROGRAMS', async () => {
	const programId = await created(creator, inputFor('gated'));
	for (const actor of [creator, outsider]) {
		expect(
			await updateProgram(actor, { ...updateInput(programId, [], ''), allowVms: true })
		).toEqual(refused);
		expect(await archiveProgram(actor, programId)).toEqual(refused);
		expect(await unarchiveProgram(actor, programId)).toEqual(refused);
		expect(await reingestProgram(actor, programId)).toEqual(refused);
	}
	expect(await db.program.findUniqueOrThrow({ where: { id: programId } })).toMatchObject({
		name: `${prefix} gated`,
		status: 'ACTIVE',
		allowVms: false
	});
	// the creator stays pinned: the refused update did not drop their membership
	expect(await pocsOf(programId)).toEqual([creator.id]);

	expect(
		await updateProgram(manager, {
			...updateInput(programId, [creator], creator.email),
			name: `${prefix} gated`,
			allowVms: true
		})
	).toEqual({ ok: true });
	expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).allowVms).toBe(true);
	expect(await reingestProgram(manager, programId)).toEqual({
		ok: false,
		status: 502,
		error: 'Re-ingestion is not configured on this deployment'
	});
	expect(await archiveProgram(manager, 'noSuchProgram')).toMatchObject({ status: 404 });
});

test('update leaves exactly one poc and moves it between organizers', async () => {
	const programId = await created(
		manager,
		inputFor('people', { organizers: [firstLead.email], poc: firstLead.email })
	);
	expect(await pocsOf(programId)).toEqual([firstLead.id]);

	await updateProgram(manager, updateInput(programId, [firstLead, secondLead], secondLead.email));
	expect(await pocsOf(programId)).toEqual([secondLead.id]);
	expect(await db.membership.count({ where: { programId } })).toBe(2);

	// mixed-case input still resolves, and the blank accent keeps the colour
	await updateProgram(
		manager,
		updateInput(programId, [firstLead, secondLead], ` ${firstLead.email.toUpperCase()} `)
	);
	expect(await pocsOf(programId)).toEqual([firstLead.id]);
	expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).color).toBe('#33d6a6');

	// a pick with no membership here, or no account at all, leaves the program without a poc
	await updateProgram(manager, updateInput(programId, [firstLead, secondLead], bystander.email));
	expect(await pocsOf(programId)).toEqual([]);
	expect(await db.membership.count({ where: { programId, userId: bystander.id } })).toBe(0);
	await updateProgram(manager, updateInput(programId, [firstLead, secondLead], firstLead.email));
	await updateProgram(manager, updateInput(programId, [firstLead, secondLead], emailFor('nobody')));
	expect(await pocsOf(programId)).toEqual([]);

	// dropping the poc from the organizers removes the membership along with the badge
	await updateProgram(manager, updateInput(programId, [firstLead, secondLead], firstLead.email));
	await updateProgram(manager, updateInput(programId, [secondLead], firstLead.email));
	expect(await pocsOf(programId)).toEqual([]);
	expect(await db.membership.count({ where: { programId, userId: firstLead.id } })).toBe(0);

	const last = await db.activityEvent.findFirstOrThrow({
		where: { programId, text: `Updated ${prefix} people settings` },
		orderBy: { createdAt: 'desc' }
	});
	expect(last.meta).toMatchObject({
		event: 'program_updated',
		organizers: [secondLead.email],
		poc: firstLead.email
	});
});

test('setPoc demotes a poc whose membership holds no permissions', async () => {
	const programId = await created(
		manager,
		inputFor('implicit', { organizers: [secondLead.email] })
	);
	// a poc's permissions are implicit, so the organizer filter alone would miss this row
	await db.membership.create({
		data: { userId: bystander.id, programId, permissions: [], isPoc: true }
	});
	const newPocId = await db.$transaction((transaction) =>
		setPoc(transaction, programId, secondLead.email)
	);
	expect(newPocId).toBe(secondLead.id);
	expect(await pocsOf(programId)).toEqual([secondLead.id]);
	expect(await db.membership.count({ where: { programId, userId: bystander.id } })).toBe(1);

	expect(await db.$transaction((transaction) => setPoc(transaction, programId, ''))).toBeNull();
	expect(await pocsOf(programId)).toEqual([]);
});

test('update swaps organizers: memberships for known people, invites for the rest', async () => {
	const programId = await created(
		manager,
		inputFor('swap', { organizers: [firstLead.email, emailFor('pending')] })
	);
	await updateProgram(manager, {
		...updateInput(programId, [secondLead], ''),
		organizers: [secondLead.email, emailFor('later')]
	});
	const members = await db.membership.findMany({ where: { programId }, select: { userId: true } });
	expect(members.map((member) => member.userId)).toEqual([secondLead.id]);
	const invites = await db.invite.findMany({ where: { programId, acceptedAt: null } });
	expect(invites.map((invite) => invite.email)).toEqual([emailFor('later')]);
});

test('archiving takes the program out of every program list and restoring brings it back', async () => {
	const programId = await created(manager, inputFor('listed', { organizers: [firstLead.email] }));
	const listedFor = async (user: App.SessionUser, query: string) => {
		const result = await loadProgramList({
			locals: { user, sessionId: null },
			url: new URL(`http://localhost/programs${query}`)
		} as never);
		return ((result as { assigned: { id: string }[] }).assigned ?? []).map((program) => program.id);
	};
	const browser = actorWith('browser', ['VIEW_ALL_PROGRAMS']);
	const member = {
		...firstLead,
		memberships: [{ programId, permissions: allPermissions, isPoc: false, tracks: [] }]
	};

	expect(await listedFor(browser, '?all=1')).toContain(programId);
	expect(await listedFor(member, '')).toContain(programId);
	expect(await archiveProgram(manager, programId)).toEqual({ ok: true });
	expect(await archiveProgram(manager, programId)).toEqual({ ok: true });
	expect(await listedFor(browser, '?all=1')).not.toContain(programId);
	expect(await listedFor(member, '')).not.toContain(programId);

	expect(await unarchiveProgram(manager, programId)).toEqual({ ok: true });
	expect(await listedFor(browser, '?all=1')).toContain(programId);
	expect(await listedFor(member, '')).toContain(programId);

	const events = await db.activityEvent.findMany({
		where: { programId, text: { contains: 'archived' } }
	});
	expect(events).toHaveLength(1);
	expect(events[0].meta).toMatchObject({
		event: 'program_archived',
		sub: 'status',
		from: 'ACTIVE',
		to: 'ARCHIVED'
	});
	expect(
		await db.activityEvent.count({ where: { programId, text: { contains: 'restored' } } })
	).toBe(1);
});
