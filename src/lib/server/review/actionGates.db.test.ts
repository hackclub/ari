import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { saveDraft } from './draft';
import { resyncShip } from './resync';
import { formOf, reviewFixtures, thrownStatus } from './reviewTestFixtures';
import { launchVm, stopVm } from './vmActions';
import { dismissWarning } from './warnings';

const fixtures = reviewFixtures('actionGatesTest');
const { programId } = fixtures;
const otherProgramId = `${programId}Other`;
let reviewer: App.SessionUser;
let secondPasser: App.SessionUser;
let outsider: App.SessionUser;
let hardwareOnly: App.SessionUser;
let own: { id: string };
let open: { id: string };
let held: { id: string };
let decided: { id: string };

const dismiss = (user: App.SessionUser, submissionId: string) =>
	dismissWarning(user, programId, submissionId, formOf({ warningId: 'warning1' }));
const launch = (user: App.SessionUser, submissionId: string) =>
	launchVm(user, programId, submissionId, formOf({ type: 'linux' }));
const resync = (user: App.SessionUser, submissionId: string) =>
	resyncShip(user, programId, submissionId);
const draft = (user: App.SessionUser, submissionId: string) =>
	saveDraft(user, programId, submissionId, {});

beforeAll(async () => {
	await fixtures.setup({ reviewersCannotReviewOwnProjects: true, allowVms: true });
	reviewer = await fixtures.user('Reviewer', { permissions: ['USE_VMS'] });
	secondPasser = await fixtures.user('SecondPasser', { permissions: ['SECOND_PASS'] });
	outsider = await fixtures.user('Outsider', { member: false });
	hardwareOnly = await fixtures.user('Hardware', { tracks: ['hardware'] });
	own = await fixtures.ship('Own', { makerEmail: reviewer.email });
	open = await fixtures.ship('Open');
	held = await fixtures.ship('Held', { status: 'secondpass' });
	decided = await fixtures.ship('Decided', { status: 'approved' });
	await db.program.create({ data: { id: otherProgramId, name: otherProgramId, color: '#338eda' } });
});

afterAll(async () => {
	await db.program.deleteMany({ where: { id: otherProgramId } });
	await fixtures.cleanup();
});

describe('the write gate', () => {
	test('the four actions refuse an own ship, an outsider, the wrong track and a held ship', async () => {
		for (const action of [dismiss, launch, resync]) {
			expect(await thrownStatus(() => action(reviewer, own.id))).toBe(403);
			expect(await thrownStatus(() => action(outsider, open.id))).toBe(403);
			expect(await thrownStatus(() => action(hardwareOnly, open.id))).toBe(403);
			expect(await thrownStatus(() => action(reviewer, held.id))).toBe(403);
			expect(await thrownStatus(() => action(reviewer, 'seedShipWeather'))).toBe(404);
		}
		const forbidden = { ok: false, status: 403, error: 'forbidden' };
		expect(await draft(reviewer, own.id)).toEqual(forbidden);
		expect(await draft(outsider, open.id)).toEqual(forbidden);
		expect(await draft(hardwareOnly, open.id)).toEqual(forbidden);
		expect(await draft(reviewer, held.id)).toEqual(forbidden);
		expect(await draft(reviewer, 'seedShipWeather')).toEqual({
			ok: false,
			status: 404,
			error: 'not_found'
		});
		expect(await db.draft.count({ where: { submissionId: { in: [own.id, open.id] } } })).toBe(0);
		expect(await fixtures.events(own.id)).toEqual([]);
	});

	test('a held ship opens to a second passer, a decided one to nobody', async () => {
		// past the gate: the stub knows no flags, so the flag itself is what is not found
		expect(await dismiss(secondPasser, held.id)).toMatchObject({
			ok: false,
			status: 404,
			failure: { code: 'notFound' }
		});
		expect(await dismiss(reviewer, open.id)).toMatchObject({
			ok: false,
			status: 404,
			failure: { code: 'notFound' }
		});
		expect(await dismiss(reviewer, decided.id)).toMatchObject({
			ok: false,
			status: 409,
			failure: { code: 'shipClosed' }
		});
		expect(await dismissWarning(reviewer, programId, open.id, formOf({}))).toMatchObject({
			ok: false,
			status: 400,
			failure: { code: 'invalid' }
		});
		expect(await resync(reviewer, decided.id)).toMatchObject({
			ok: false,
			status: 400,
			failure: { code: 'shipClosed' }
		});
		expect(await draft(reviewer, open.id)).toEqual({ ok: true });
	});

	test('launching a vm is gated before the platform is consulted', async () => {
		// no platform in a test: the refusal shows the gate let a member through
		expect(await launch(reviewer, open.id)).toMatchObject({
			ok: false,
			status: 400,
			failure: { code: 'vmUnavailable' }
		});
		expect(await launch(secondPasser, held.id)).toMatchObject({
			ok: false,
			status: 400,
			failure: { code: 'vmUnavailable' }
		});
	});
});

describe('stopVm', () => {
	test('only reaches a vm of the caller in the route’s program', async () => {
		const machine = {
			submissionId: open.id,
			reviewerId: reviewer.id,
			vmid: 1,
			vmType: 'linux',
			name: 'vm1',
			guacUrl: 'https://example.com/vm1'
		};
		await db.reviewerVm.create({ data: { ...machine, programId: otherProgramId } });
		expect(await thrownStatus(() => stopVm(outsider, programId, open.id))).toBe(403);
		expect(await stopVm(reviewer, programId, open.id)).toEqual({
			ok: true,
			data: { success: true }
		});
		expect(await db.reviewerVm.count({ where: { submissionId: open.id } })).toBe(1);
		expect(await fixtures.events(open.id)).toEqual([]);

		// no platform in a test: the refusal shows the row was found
		await db.reviewerVm.updateMany({ where: { submissionId: open.id }, data: { programId } });
		expect(await stopVm(reviewer, programId, open.id)).toMatchObject({
			ok: false,
			status: 502,
			failure: { code: 'vmFailed' }
		});
		expect(await db.reviewerVm.count({ where: { submissionId: open.id } })).toBe(1);
	});
});
