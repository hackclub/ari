import { describe, expect, test } from 'bun:test';
import { decisionFormBody } from '$lib/review/decisionForm';
import {
	confirmFormBody,
	confirmNoteGaps,
	confirmToast,
	decisionOf,
	decisionToast,
	problemsForAction,
	webhookProblem,
	type RuleSources
} from './decisionOutcome';
import { emptyDraft } from './draftSeed';

const audit = 'a'.repeat(100); // the approval minimum

const sources = (overrides: Partial<RuleSources> = {}): RuleSources => ({
	status: 'pending',
	hoursJustification: false,
	checklistCount: 2,
	customFields: [],
	requiredFixIds: [],
	draft: { ...emptyDraft(), note: 'Nice', audit, checks: [true, true] },
	settlement: { adjustments: {} },
	deflateSeconds: null,
	canAct: true,
	canSecondPass: false,
	isPoc: false,
	held: null,
	...overrides
});

const codes = (action: Parameters<typeof problemsForAction>[0], input: RuleSources) =>
	problemsForAction(action, input).map((problem) => problem.code);

describe('problems per action', () => {
	test('a complete draft can be approved', () => {
		expect(codes('approve', sources())).toEqual([]);
	});

	test('approve is blocked by the checklist and a short audit note, changes and reject are not', () => {
		const input = sources({
			draft: { ...emptyDraft(), note: 'Nice', audit: 'short', checks: [true, false] }
		});
		expect(codes('approve', input)).toEqual(['auditTooShort', 'checklistIncomplete']);
		expect(codes('changes', input)).toEqual([]);
		expect(codes('reject', input)).toEqual([]);
	});

	test('a ship with justification on needs its features and the required custom field', () => {
		const input = sources({
			hoursJustification: true,
			customFields: [
				{ key: 'buildQuality', label: 'Build quality', type: 'select', required: true }
			]
		});
		expect(problemsForAction('approve', input).map((problem) => problem.field)).toEqual([
			'technicalFeatures',
			'field:buildQuality'
		]);
	});

	test('a deflated decision needs its reason whatever the decision', () => {
		const input = sources({ hoursJustification: true, deflateSeconds: 600 });
		expect(codes('changes', input)).toEqual(['deflationReasonRequired']);
	});

	test('a read-only viewer is told first', () => {
		expect(codes('reject', sources({ canAct: false }))[0]).toBe('claimHeldByOther');
	});

	test('confirming a held decision follows the confirm rules, not the reviewer ones', () => {
		const held = sources({
			status: 'secondpass',
			canSecondPass: true,
			held: { decision: 'approved', madeByViewer: false },
			draft: { ...emptyDraft(), note: '', audit: '', checks: [] }
		});
		expect(codes('confirm', held)).toEqual([]);
		expect(codes('confirmChanges', held)).toEqual(['overrideNoteRequired']);
		expect(codes('confirmReject', held)).toEqual(['overrideNoteRequired']);
	});

	test('nobody confirms their own held decision', () => {
		const own = sources({
			status: 'secondpass',
			canSecondPass: true,
			held: { decision: 'changes', madeByViewer: true }
		});
		expect(codes('confirm', own)).toEqual(['ownHeldDecision']);
		expect(codes('confirm', { ...own, isPoc: true })).toEqual([]);
	});

	test('the decision each action resolves to', () => {
		expect(decisionOf('approve', null)).toBe('approved');
		expect(decisionOf('confirm', 'rejected')).toBe('rejected');
		expect(decisionOf('confirmChanges', 'approved')).toBe('changes');
	});
});

describe('results', () => {
	test('a held decision says so instead of claiming it was sent', () => {
		expect(
			decisionToast(
				{
					success: true,
					decision: 'approved',
					outcome: 'held',
					approvedSeconds: 5400,
					webhook: null
				},
				'Weather'
			)
		).toEqual({ tone: 'info', message: 'Held Weather for second pass' });
	});

	test('a final approval shows the exact time', () => {
		expect(
			decisionToast(
				{
					success: true,
					decision: 'approved',
					outcome: 'final',
					approvedSeconds: 5461,
					webhook: 'queued'
				},
				'Weather'
			).message
		).toBe('Approved Weather · 1h 31m 1s');
	});

	test('only a delivery the program should have had is a problem', () => {
		expect(webhookProblem(null)).toBeNull();
		expect(webhookProblem('queued')).toBeNull();
		expect(webhookProblem('noEndpoint')).toBeNull();
		expect(webhookProblem('notSigned')).toContain('signing secret');
		expect(webhookProblem('blockedUrl')).toContain('not allowed');
		expect(webhookProblem('failed')).toContain('could not be queued');
	});

	test('a confirm names what was sent', () => {
		const result = {
			success: true,
			decision: 'approved',
			overridden: false,
			approvedSeconds: 60,
			webhook: 'queued'
		} as const;
		expect(confirmToast(result, 'Weather', 'Lighthouse').message).toBe(
			'Confirmed, approval sent to Lighthouse'
		);
		expect(
			confirmToast({ ...result, decision: 'changes', overridden: true }, 'Weather', 'Lighthouse')
				.message
		).toBe('Sent Weather back for changes');
	});
});

describe('confirm form', () => {
	const body = decisionFormBody(
		{ ...emptyDraft(), note: 'ok', deflateSeconds: 900, adjustments: { devlogs: { one: 60 } } },
		4
	);

	test('untouched time is left out so the held values stand', () => {
		const posted = confirmFormBody(body, { timeEdited: false, decision: null });
		expect(Object.keys(posted)).not.toContain('adjustments');
		expect(Object.keys(posted)).not.toContain('deflateSeconds');
		expect(Object.keys(posted)).not.toContain('collaboratorDeflates');
		expect(posted).toMatchObject({ note: 'ok', ingestVersion: '4' });
		expect(posted.decision).toBeUndefined();
	});

	test('edited time and an override ride along, the reviewer ticks never do', () => {
		const posted = confirmFormBody(body, { timeEdited: true, decision: 'rejected' });
		expect(posted).toMatchObject({ deflateSeconds: '900', decision: 'rejected' });
		expect(JSON.parse(posted.adjustments)).toEqual({ devlogs: { one: 60 } });
		expect(Object.keys(posted)).not.toContain('checks');
		expect(Object.keys(posted)).not.toContain('fixChecks');
	});
});

describe('what a confirm leaves unasked', () => {
	const held = (decision: 'approved' | 'changes' | 'rejected') => ({
		status: 'secondpass',
		canSecondPass: true,
		held: { decision, madeByViewer: false }
	});
	const gaps = (action: Parameters<typeof confirmNoteGaps>[0], input: RuleSources) =>
		confirmNoteGaps(action, input).map((problem) => problem.code);

	test('a held approval with thin notes confirms, and the gaps are named', () => {
		const input = sources({
			...held('approved'),
			hoursJustification: true,
			draft: { ...emptyDraft(), technicalFeatures: 'A hinge', audit: 'short' }
		});
		expect(codes('confirm', input)).toEqual([]);
		expect(gaps('confirm', input)).toEqual(['noteRequired', 'auditTooShort']);
	});

	test('a field the confirm already refuses is not repeated as a gap', () => {
		const input = sources({ ...held('approved'), draft: emptyDraft() });
		expect(codes('confirmReject', input)).toEqual(['overrideNoteRequired']);
		expect(gaps('confirmReject', input)).toEqual(['auditRequired']);
	});

	test('complete notes leave no gap, and an open decision has none by definition', () => {
		expect(gaps('confirm', sources(held('approved')))).toEqual([]);
		expect(gaps('approve', sources({ draft: emptyDraft() }))).toEqual([]);
	});
});
