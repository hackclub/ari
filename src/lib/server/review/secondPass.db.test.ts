import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { replayLegacyReview } from '$lib/server/outboundRedispatch';
import { decideShip } from './decide';
import { loadReviewPage } from './load';
import { decisionForm, formOf, reviewFixtures, thrownStatus } from './reviewTestFixtures';
import { confirmSecondPass } from './secondPass';
import { returnSecondPass } from './secondPassReturn';
import { settlementInclude } from './settlementRows';

const fixtures = reviewFixtures('secondPassTest');
const { programId } = fixtures;
let reviewer: App.SessionUser;
let lead: App.SessionUser;
let organizer: App.SessionUser;

const shipRow = (id: string) => db.submission.findUniqueOrThrow({ where: { id } });
const reviewOf = (submissionId: string) => db.review.findFirstOrThrow({ where: { submissionId } });
const setProgram = (data: Record<string, boolean>) =>
	db.program.update({ where: { id: programId }, data });

async function heldShip(label: string, fields: Record<string, unknown> = {}) {
	const ship = await fixtures.ship(label);
	const held = await decideShip('approved', reviewer, programId, ship.id, decisionForm(fields));
	expect(held.ok && held.data.outcome).toBe('held');
	return ship;
}

beforeAll(async () => {
	await fixtures.setup({ secondPass: true });
	reviewer = await fixtures.user('Reviewer');
	lead = await fixtures.user('Lead', { permissions: ['SECOND_PASS'] });
	organizer = await fixtures.user('Organizer', { isPoc: true });
});

afterAll(fixtures.cleanup);

describe('confirming a held decision', () => {
	test('the confirm sends the numbers that were held', async () => {
		const ship = await heldShip('Confirm', {
			adjustments: { devlogs: { secondPassPlaceholder: 1 } },
			deflateSeconds: 1288
		});
		const page = await loadReviewPage({
			user: lead,
			programId,
			submissionId: ship.id,
			url: new URL('http://localhost/p/x/review/y'),
			meta: {
				color: '#338eda',
				excludeOwnProjects: false,
				reauthRequired: false,
				reauthTtlMinutes: 60,
				reviewGoal: 10,
				allowVms: false,
				allowDeflation: true,
				hoursJustification: false
			}
		});
		// held time is shown after the deflate
		expect(page.recorded).toMatchObject({
			decision: 'approved',
			timeModel: 'seconds',
			madeByViewer: false,
			approvedSeconds: 7288,
			deflateSeconds: 1288,
			reported: { approvedSeconds: 6000 } // 7288 - 1288
		});
		expect(page.state).toMatchObject({ secondPass: true, canEditHeld: true, closed: true });

		const result = await confirmSecondPass(lead, programId, ship.id, null);
		expect(result).toEqual({
			ok: true,
			data: {
				success: true,
				decision: 'approved',
				overridden: false,
				approvedSeconds: 6000,
				webhook: 'queued'
			}
		});
		expect((await shipRow(ship.id)).status).toBe('approved');
		const [delivery] = await fixtures.deliveries(ship.id);
		expect(delivery.event).toBe('review.approved');
		expect(delivery.payload.review.approved_seconds).toBe(6000);
		expect(delivery.payload.review.reviewer).toMatchObject({ email: reviewer.email });
		const confirmEvent = (await fixtures.events(ship.id))[1];
		expect(confirmEvent.text).toBe('Confirmed approval of Confirm ship');
		expect(confirmEvent.actorId).toBe(lead.id);
		expect(confirmEvent.meta).toMatchObject({
			op: 'second-pass-confirmed',
			reviewerId: reviewer.id,
			approvedSeconds: 7288
		});
		expect((confirmEvent.meta as { editedAtConfirm?: boolean }).editedAtConfirm).toBeUndefined();

		// a double click cannot send twice
		const again = await confirmSecondPass(lead, programId, ship.id, null);
		expect(again).toMatchObject({ ok: false, status: 404 });
		expect(await fixtures.deliveries(ship.id)).toHaveLength(1);
	});

	test('organizer edits are re-settled, stored and sent', async () => {
		const ship = await heldShip('Edited');
		const result = await confirmSecondPass(
			lead,
			programId,
			ship.id,
			decisionForm({
				note: 'Edited note.',
				adjustments: { devlogs: { [ship.devlogId]: 830 } },
				deflateSeconds: 288
			})
		);
		expect(result.ok && result.data.approvedSeconds).toBe(6000); // 6288 - 288
		expect(await reviewOf(ship.id)).toMatchObject({
			noteToMaker: 'Edited note.',
			approvedSeconds: 6288, // 5429 + 830 + 29
			deflateSeconds: 288,
			settlementVersion: 3
		});
		const [delivery] = await fixtures.deliveries(ship.id);
		expect(delivery.payload.review.approved_seconds).toBe(6000);
		expect((await fixtures.events(ship.id))[1].meta).toMatchObject({ editedAtConfirm: true });
	});

	test('a version 2 review held by the old app confirms through the legacy replay', async () => {
		const ship = await fixtures.ship('Legacy', { status: 'secondpass' });
		await db.review.create({
			data: {
				submissionId: ship.id,
				reviewerId: reviewer.id,
				decision: 'approved',
				noteToMaker: 'Held by the old app.',
				auditNote: 'audit',
				fieldValues: {},
				checklist: [],
				settlementVersion: 2,
				approvedMinutes: 110,
				adjustments: { devlogs: { [ship.devlogId]: 20 } },
				deflateMinutes: 5
			}
		});
		const rows = await db.submission.findUniqueOrThrow({
			where: { id: ship.id },
			include: { ...settlementInclude, reviews: true }
		});
		const expected = replayLegacyReview(rows, rows.reviews[0]).reported;
		// 90 tracked + 20 journal, less the 5 minute deflate. the 29 s clip rounds to nothing
		expect(expected.approvedMinutes).toBe(105);

		// posting the held values back unchanged is not an edit
		const result = await confirmSecondPass(
			lead,
			programId,
			ship.id,
			decisionForm({
				note: 'Held by the old app.',
				audit: 'audit',
				adjustments: { devlogs: { [ship.devlogId]: 1200 } },
				deflateSeconds: 300
			})
		);
		expect(result.ok && result.data).toMatchObject({ approvedSeconds: 6300, webhook: 'queued' }); // 105 * 60
		const [delivery] = await fixtures.deliveries(ship.id);
		expect(delivery.payload.review).toMatchObject({
			approved_minutes: 105,
			approved_seconds: 6300,
			minutes_breakdown: expected.breakdown
		});
		expect(await reviewOf(ship.id)).toMatchObject({
			settlementVersion: 2,
			approvedMinutes: 110,
			deflateMinutes: 5
		});
		expect((await fixtures.events(ship.id))[0].meta).toMatchObject({ approvedMinutes: 110 });
	});

	test('editing the time of a legacy held review re-settles it in seconds', async () => {
		const ship = await fixtures.ship('LegacyEdited', { status: 'secondpass' });
		await db.review.create({
			data: {
				submissionId: ship.id,
				reviewerId: reviewer.id,
				decision: 'approved',
				noteToMaker: 'Held by the old app.',
				auditNote: 'audit',
				fieldValues: {},
				checklist: [],
				settlementVersion: 2,
				approvedMinutes: 121
			}
		});
		const result = await confirmSecondPass(
			lead,
			programId,
			ship.id,
			decisionForm({ deflateSeconds: 288, adjustments: {} })
		);
		expect(result.ok && result.data.approvedSeconds).toBe(7000); // 7288 - 288
		expect(await reviewOf(ship.id)).toMatchObject({
			settlementVersion: 3,
			approvedSeconds: 7288,
			deflateSeconds: 288,
			approvedMinutes: 121
		});
		expect((await fixtures.deliveries(ship.id))[0].payload.review.approved_seconds).toBe(7000);
	});

	test('confirming as changes or as a rejection overrides the held decision', async () => {
		for (const [decision, eventName, text] of [
			['changes', 'review.changes', 'Requested changes on'],
			['rejected', 'review.rejected', 'Rejected']
		] as const) {
			const ship = await heldShip(`Override${decision}`);
			const form = decisionForm({ note: 'Please fix the demo.' });
			form.set('decision', decision);
			const result = await confirmSecondPass(lead, programId, ship.id, form);
			expect(result.ok && result.data).toMatchObject({ decision, overridden: true });
			expect((await shipRow(ship.id)).status).toBe(decision);
			expect((await reviewOf(ship.id)).decision).toBe(decision);
			expect((await fixtures.deliveries(ship.id))[0].event).toBe(eventName);
			const event = (await fixtures.events(ship.id))[1];
			expect(event.text).toBe(`${text} Override${decision} ship (second pass)`);
			expect(event.meta).toMatchObject({
				op: 'second-pass-overridden',
				heldDecision: 'approved',
				editedAtConfirm: true
			});
		}

		const blank = await heldShip('OverrideBlank');
		const form = decisionForm({ note: '  ' });
		form.set('decision', 'rejected');
		const refused = await confirmSecondPass(lead, programId, blank.id, form);
		expect(refused).toMatchObject({
			ok: false,
			status: 400,
			failure: { code: 'overrideNoteRequired' }
		});
		expect((await shipRow(blank.id)).status).toBe('secondpass');
	});

	test('only second-pass holders act, and only the poc on their own decision', async () => {
		const ship = await heldShip('Gate');
		expect(await thrownStatus(() => confirmSecondPass(reviewer, programId, ship.id, null))).toBe(
			403
		);
		expect(
			await thrownStatus(() =>
				returnSecondPass(reviewer, programId, ship.id, formOf({ reason: 'No' }))
			)
		).toBe(403);

		const own = await fixtures.ship('OwnHeld');
		await decideShip('approved', lead, programId, own.id, decisionForm());
		const refused = await confirmSecondPass(lead, programId, own.id, null);
		expect(refused).toMatchObject({ ok: false, status: 403, failure: { code: 'ownHeldDecision' } });
		expect((await shipRow(own.id)).status).toBe('secondpass');
		expect(await fixtures.deliveries(own.id)).toEqual([]);

		await setProgram({ secondPassOrganizerBypass: false });
		const pocOwn = await fixtures.ship('PocOwnHeld');
		const pocHeld = await decideShip('approved', organizer, programId, pocOwn.id, decisionForm());
		await setProgram({ secondPassOrganizerBypass: true });
		expect(pocHeld.ok && pocHeld.data.outcome).toBe('held');
		expect((await confirmSecondPass(organizer, programId, pocOwn.id, null)).ok).toBe(true);
		expect((await shipRow(pocOwn.id)).status).toBe('approved');

		const stale = await confirmSecondPass(organizer, programId, ship.id, decisionForm({}, 9));
		expect(stale).toMatchObject({ ok: false, status: 409, failure: { code: 'staleIngest' } });
		expect((await confirmSecondPass(organizer, programId, ship.id, null)).ok).toBe(true);
	});

	test('a justified program refuses a confirm that ships without its features', async () => {
		const ship = await heldShip('Justified', { deflateSeconds: 60 });
		await setProgram({ hoursJustification: true });
		const bare = await confirmSecondPass(lead, programId, ship.id, null);
		const withFeatures = await confirmSecondPass(
			lead,
			programId,
			ship.id,
			decisionForm({ technicalFeatures: 'Parser.', deflateSeconds: 60 })
		);
		const complete = await confirmSecondPass(
			lead,
			programId,
			ship.id,
			decisionForm({
				technicalFeatures: 'Parser.',
				deflationReason: 'Idle time.',
				deflateSeconds: 60
			})
		);
		await setProgram({ hoursJustification: false });
		expect(bare).toMatchObject({ ok: false, failure: { code: 'technicalFeaturesRequired' } });
		expect(withFeatures).toMatchObject({ ok: false, failure: { code: 'deflationReasonRequired' } });
		expect(complete.ok && complete.data.approvedSeconds).toBe(7228); // 7288 - 60
	});
});

describe('a held review recorded on the earlier flow', () => {
	const earlier = {
		timeEvidence: 'time evidence 1.',
		supportingEvidence: 'supporting evidence 1.',
		hoursReasoning: 'hours reasoning 1.',
		additionalJustification: 'additional justification 1.'
	};
	const heldEarlier = async (label: string) => {
		const ship = await heldShip(label, { technicalFeatures: 'technical features 1.' });
		await db.review.updateMany({ where: { submissionId: ship.id }, data: earlier });
		return ship;
	};

	test('a confirm keeps its texts as stored, shows them and sends them', async () => {
		const ship = await heldEarlier('EarlierConfirm');
		await setProgram({ hoursJustification: true });
		const page = await loadReviewPage({
			user: lead,
			programId,
			submissionId: ship.id,
			url: new URL('http://localhost/p/x/review/y'),
			meta: {
				color: '#338eda',
				excludeOwnProjects: false,
				reauthRequired: false,
				reauthTtlMinutes: 60,
				reviewGoal: 10,
				allowVms: false,
				allowDeflation: true,
				hoursJustification: true
			}
		});
		const form = decisionForm({
			note: 'Edited at second pass.',
			technicalFeatures: 'technical features 1.'
		});
		// a client that still posts one cannot overwrite what was recorded
		form.set('timeEvidence', 'overwritten');
		const result = await confirmSecondPass(lead, programId, ship.id, form);
		await setProgram({ hoursJustification: false });

		expect(page.recorded?.earlierInputs).toEqual(earlier);
		expect('timeEvidence' in page.recorded!).toBe(false);
		expect(result.ok).toBe(true);
		expect(await reviewOf(ship.id)).toMatchObject({
			noteToMaker: 'Edited at second pass.',
			...earlier
		});
		const [delivery] = await fixtures.deliveries(ship.id);
		const justification = delivery.payload.review.justification as Record<string, string>;
		expect(justification).toMatchObject({
			technical_features: 'technical features 1.',
			time_evidence: 'time evidence 1.',
			supporting_evidence: 'supporting evidence 1.',
			hours_reasoning: 'hours reasoning 1.',
			additional_justification: 'additional justification 1.'
		});
		expect('unified_db_record' in justification).toBe(false);
	});

	test('a return to the queue leaves them on the review and out of the new draft', async () => {
		const ship = await heldEarlier('EarlierReturn');
		const returned = await returnSecondPass(
			lead,
			programId,
			ship.id,
			formOf({ reason: 'Look again.' })
		);
		expect(returned.ok).toBe(true);
		expect(await reviewOf(ship.id)).toMatchObject(earlier);
		expect(await db.draft.findFirstOrThrow({ where: { submissionId: ship.id } })).toMatchObject({
			technicalFeatures: 'technical features 1.',
			timeEvidence: '',
			supportingEvidence: '',
			hoursReasoning: '',
			additionalJustification: ''
		});
	});
});
