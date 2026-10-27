import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { decideShip } from './decide';
import { saveReviewerNote } from './reviewerNote';
import { decisionForm, formOf, reviewFixtures, thrownStatus } from './reviewTestFixtures';

const fixtures = reviewFixtures('reviewerNoteTest');
const { programId } = fixtures;
let reviewer: App.SessionUser;
let outsider: App.SessionUser;

beforeAll(async () => {
	await fixtures.setup();
	reviewer = await fixtures.user('Reviewer');
	outsider = await fixtures.user('Outsider', { member: false });
});

afterAll(fixtures.cleanup);

describe('reviewer note', () => {
	test('saves without a claim or a decision', async () => {
		const ship = await fixtures.ship('Note');
		const outcome = await saveReviewerNote(
			reviewer,
			programId,
			ship.id,
			formOf({ reviewerNote: 'Check the commits twice.' })
		);
		expect(outcome.ok).toBe(true);
		const row = await db.submission.findUniqueOrThrow({ where: { id: ship.id } });
		expect(row.reviewerNote).toBe('Check the commits twice.');
		expect(row.status).toBe('pending');
		expect(await db.review.count({ where: { submissionId: ship.id } })).toBe(0);
	});

	test('survives a decision and stays off the review row', async () => {
		const ship = await fixtures.ship('Kept');
		await saveReviewerNote(reviewer, programId, ship.id, formOf({ reviewerNote: 'Kept note.' }));
		const decided = await decideShip('approved', reviewer, programId, ship.id, decisionForm());
		expect(decided.ok).toBe(true);
		const row = await db.submission.findUniqueOrThrow({ where: { id: ship.id } });
		expect(row.reviewerNote).toBe('Kept note.');
		const [review] = await db.review.findMany({ where: { submissionId: ship.id } });
		expect(review.auditNote).not.toContain('Kept note.');
		expect(review.noteToMaker).not.toContain('Kept note.');
	});

	test('a signed-out program member cannot save', async () => {
		const ship = await fixtures.ship('Denied');
		expect(
			await thrownStatus(() =>
				saveReviewerNote(outsider, programId, ship.id, formOf({ reviewerNote: 'x' }))
			)
		).toBe(403);
	});
});
