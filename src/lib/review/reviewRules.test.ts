import { describe, expect, test } from 'bun:test';
import {
	auditMinimumLength,
	canConfirm,
	canDecide,
	checklistComplete,
	collaboratorNotesFor,
	confirmProblems,
	decisionProblems,
	fieldValueMissing,
	isDeflated,
	overrideProblems,
	returnProblems,
	unconfirmedFixIds,
	type ConfirmRuleInput,
	type DecisionRuleInput
} from './reviewRules';

const longAudit = 'a'.repeat(auditMinimumLength());

const approval = (overrides: Partial<DecisionRuleInput> = {}): DecisionRuleInput => ({
	decision: 'approved',
	status: 'pending',
	program: { hoursJustification: true },
	checklist: { count: 2, checks: [true, true] },
	fields: { definitions: [], values: {} },
	fixes: { requiredIds: [], confirmedIds: [] },
	notes: {
		note: 'Nice work.',
		audit: longAudit,
		technicalFeatures: 'Parser and renderer.',
		deflationReason: ''
	},
	settlement: { adjustments: {} },
	deflateSeconds: null,
	viewer: { canAct: true },
	...overrides
});

const codes = (input: DecisionRuleInput) => decisionProblems(input).map((problem) => problem.code);

describe('decisionProblems', () => {
	test('a complete approval has no problems', () => {
		expect(decisionProblems(approval())).toEqual([]);
		expect(canDecide(approval())).toBe(true);
	});

	test('every decision needs both notes', () => {
		for (const decision of ['approved', 'changes', 'rejected'] as const) {
			const input = approval({
				decision,
				notes: { ...approval().notes, note: '  ', audit: ' ' }
			});
			expect(codes(input).slice(0, 2)).toEqual(['noteRequired', 'auditRequired']);
		}
	});

	test('the audit minimum applies to approvals only, on the trimmed text', () => {
		const short = { ...approval().notes, audit: ` ${'a'.repeat(auditMinimumLength() - 1)}  ` };
		expect(codes(approval({ notes: short }))).toEqual(['auditTooShort']);
		expect(decisionProblems(approval({ notes: short }))[0]).toEqual({
			code: 'auditTooShort',
			field: 'audit',
			message: 'Internal audit note must be at least 100 characters for approvals.'
		});
		expect(codes(approval({ decision: 'changes', notes: short }))).toEqual([]);
		expect(codes(approval({ decision: 'rejected', notes: short }))).toEqual([]);
	});

	test('technical features are required to approve only when the program asks for justification', () => {
		const notes = { ...approval().notes, technicalFeatures: ' ' };
		expect(codes(approval({ notes }))).toEqual(['technicalFeaturesRequired']);
		expect(codes(approval({ notes, program: { hoursJustification: false } }))).toEqual([]);
		expect(codes(approval({ notes, decision: 'rejected' }))).toEqual([]);
	});

	test('required custom fields gate approving only', () => {
		const fields = {
			definitions: [
				{ key: 'level', label: 'Level', type: 'select' as const, required: true },
				{ key: 'ok', label: 'Verified', type: 'checkbox' as const, required: true },
				{ key: 'tags', label: 'Tags', type: 'multiselect' as const, required: true },
				{ key: 'extra', label: 'Extra', type: 'text' as const, required: false }
			],
			values: { level: ' ', ok: 'true', tags: [] }
		};
		const problems = decisionProblems(approval({ fields }));
		expect(problems.map((problem) => problem.field)).toEqual([
			'field:level',
			'field:ok',
			'field:tags'
		]);
		expect(problems[0].message).toBe('"Level" is required before approving.');
		expect(codes(approval({ fields, decision: 'changes' }))).toEqual([]);
		expect(codes(approval({ fields, decision: 'rejected' }))).toEqual([]);
		expect(
			codes(
				approval({
					fields: { ...fields, values: { level: 'Gold', ok: true, tags: ['one'] } }
				})
			)
		).toEqual([]);
	});

	test('the checklist must be fully ticked to approve, and never blocks the other decisions', () => {
		for (const checks of [[true, false], [true], [true, true, true], 'yes', [true, 'true']]) {
			expect(codes(approval({ checklist: { count: 2, checks } }))).toEqual(['checklistIncomplete']);
		}
		expect(codes(approval({ checklist: { count: 0, checks: [] } }))).toEqual([]);
		expect(codes(approval({ decision: 'changes', checklist: { count: 2, checks: [] } }))).toEqual(
			[]
		);
	});

	test('a re-ship after requested changes must have that feedback confirmed', () => {
		const fixes = { requiredIds: ['reviewOne'], confirmedIds: ['other'] };
		expect(codes(approval({ fixes }))).toEqual(['fixesUnconfirmed']);
		expect(
			codes(approval({ fixes: { requiredIds: ['reviewOne'], confirmedIds: ['reviewOne'] } }))
		).toEqual([]);
		expect(codes(approval({ fixes, decision: 'rejected' }))).toEqual([]);
	});

	test('any deflation needs its reason, for every decision, when justification is on', () => {
		const flat = approval({ deflateSeconds: 60 });
		expect(codes(flat)).toEqual(['deflationReasonRequired']);
		const perRow = approval({ settlement: { adjustments: { devlogs: { rowOne: 10 } } } });
		expect(codes(perRow)).toEqual(['deflationReasonRequired']);
		expect(codes({ ...flat, decision: 'changes' })).toEqual(['deflationReasonRequired']);
		expect(codes({ ...flat, program: { hoursJustification: false } })).toEqual([]);
		expect(
			codes({ ...flat, notes: { ...flat.notes, deflationReason: 'Idle time in the journal.' } })
		).toEqual([]);
	});

	test('a closed ship or a claim held elsewhere comes first', () => {
		expect(codes(approval({ viewer: { canAct: false }, status: 'approved' }))).toEqual([
			'claimHeldByOther',
			'shipClosed'
		]);
		expect(decisionProblems(approval({ status: 'fraudreview' }))[0].message).toBe(
			'This ship is under fraud review. No one can act on it until the verdict lands.'
		);
		expect(decisionProblems(approval({ status: 'secondpass' }))[0].message).toBe(
			'This ship is no longer open for review.'
		);
	});

	test('problems come in the order the server reports them', () => {
		const input = approval({
			checklist: { count: 1, checks: [] },
			fields: {
				definitions: [{ key: 'level', label: 'Level', type: 'text', required: true }],
				values: {}
			},
			fixes: { requiredIds: ['reviewOne'], confirmedIds: [] },
			notes: {
				note: '',
				audit: '',
				technicalFeatures: '',
				deflationReason: ''
			},
			deflateSeconds: 30
		});
		expect(codes(input)).toEqual([
			'noteRequired',
			'auditRequired',
			'technicalFeaturesRequired',
			'fieldRequired',
			'checklistIncomplete',
			'fixesUnconfirmed',
			'deflationReasonRequired'
		]);
	});
});

describe('helpers', () => {
	test('isDeflated reads the flat cut and any recorded row', () => {
		expect(isDeflated({}, null)).toBe(false);
		expect(isDeflated({ devlogs: {}, clips: {} }, 0)).toBe(false);
		expect(isDeflated({}, 1)).toBe(true);
		expect(isDeflated({ hackatime: { hackatime: 0 } }, null)).toBe(true);
		expect(isDeflated(null, undefined)).toBe(false);
	});

	test('fieldValueMissing by type', () => {
		expect(fieldValueMissing('checkbox', false)).toBe(true);
		expect(fieldValueMissing('checkbox', true)).toBe(false);
		expect(fieldValueMissing('multiselect', 'one')).toBe(true);
		expect(fieldValueMissing('multiselect', ['one'])).toBe(false);
		expect(fieldValueMissing('text', null)).toBe(true);
		expect(fieldValueMissing('text', undefined)).toBe(true);
		expect(fieldValueMissing('number', 0)).toBe(false);
		expect(fieldValueMissing('select', '  ')).toBe(true);
	});

	test('checklistComplete and unconfirmedFixIds', () => {
		expect(checklistComplete(0, null)).toBe(true);
		expect(checklistComplete(1, [true])).toBe(true);
		expect(checklistComplete(1, [])).toBe(false);
		expect(unconfirmedFixIds(['one', 'two'], ['two', 3])).toEqual(['one']);
		expect(unconfirmedFixIds([], 'nope')).toEqual([]);
	});

	test('collaborator notes keep known people, trimmed and capped', () => {
		expect(
			collaboratorNotesFor(
				{ known: '  hello  ', stranger: 'no', blank: '   ', odd: 4, long: 'x'.repeat(10050) },
				['known', 'blank', 'odd', 'long']
			)
		).toEqual({ known: 'hello', long: 'x'.repeat(10000) });
		expect(collaboratorNotesFor('nope', ['known'])).toEqual({});
		expect(collaboratorNotesFor(['a'], ['0'])).toEqual({});
	});
});

const confirm = (overrides: Partial<ConfirmRuleInput> = {}): ConfirmRuleInput => ({
	heldDecision: 'approved',
	decision: 'approved',
	status: 'secondpass',
	program: { hoursJustification: true },
	notes: { note: 'Nice.', technicalFeatures: 'Parser.', deflationReason: '' },
	settlement: { adjustments: {} },
	deflateSeconds: null,
	viewer: { canSecondPass: true, madeHeldDecision: false, isPoc: false },
	...overrides
});

const confirmCodes = (input: ConfirmRuleInput) =>
	confirmProblems(input).map((problem) => problem.code);

describe('confirmProblems', () => {
	test('a plain confirm of a complete held approval passes', () => {
		expect(confirmCodes(confirm())).toEqual([]);
		expect(canConfirm(confirm())).toBe(true);
	});

	test('only second-pass holders, never the reviewer who made the decision', () => {
		expect(
			confirmCodes(
				confirm({ viewer: { canSecondPass: false, madeHeldDecision: false, isPoc: false } })
			)
		).toEqual(['secondPassPermission']);
		expect(
			confirmCodes(
				confirm({ viewer: { canSecondPass: true, madeHeldDecision: true, isPoc: false } })
			)
		).toEqual(['ownHeldDecision']);
		expect(confirmCodes(confirm({ status: 'pending' }))).toEqual(['notAwaitingSecondPass']);
	});

	test('the poc may confirm their own held decision', () => {
		expect(
			confirmCodes(
				confirm({ viewer: { canSecondPass: true, madeHeldDecision: true, isPoc: true } })
			)
		).toEqual([]);
	});

	test('overriding to changes or reject needs a note, confirming as held does not', () => {
		const blank = { note: ' ', technicalFeatures: 'Parser.', deflationReason: '' };
		expect(confirmCodes(confirm({ decision: 'changes', notes: blank }))).toEqual([
			'overrideNoteRequired'
		]);
		expect(confirmCodes(confirm({ decision: 'rejected', notes: blank }))).toEqual([
			'overrideNoteRequired'
		]);
		expect(
			confirmCodes(confirm({ heldDecision: 'changes', decision: 'changes', notes: blank }))
		).toEqual([]);
		expect(confirmCodes(confirm({ notes: blank }))).toEqual([]);
	});

	test('an approval that ships needs its features, and a deflation its reason', () => {
		const bare = { note: 'Nice.', technicalFeatures: '', deflationReason: '' };
		expect(confirmCodes(confirm({ notes: bare }))).toEqual(['technicalFeaturesRequired']);
		expect(
			confirmCodes(confirm({ heldDecision: 'changes', decision: 'approved', notes: bare }))
		).toEqual(['technicalFeaturesRequired']);
		expect(confirmCodes(confirm({ decision: 'rejected', notes: bare }))).toEqual([]);
		expect(confirmCodes(confirm({ deflateSeconds: 60 }))).toEqual(['deflationReasonRequired']);
		expect(
			confirmCodes(confirm({ deflateSeconds: 60, program: { hoursJustification: false } }))
		).toEqual([]);
	});
});

describe('return and overrides', () => {
	test('returning a held ship needs a reason and a held ship', () => {
		const viewer = { canSecondPass: true };
		expect(returnProblems({ reason: 'Redo', status: 'secondpass', viewer })).toEqual([]);
		expect(
			returnProblems({ reason: ' ', status: 'secondpass', viewer }).map((problem) => problem.code)
		).toEqual(['reasonRequired']);
		expect(
			returnProblems({ reason: 'Redo', status: 'pending', viewer }).map((problem) => problem.code)
		).toEqual(['notAwaitingSecondPass']);
		expect(
			returnProblems({ reason: 'Redo', status: 'secondpass', viewer: { canSecondPass: false } })[0]
				.code
		).toBe('secondPassPermission');
	});

	test('revert needs both texts, requeue only the audit reason, both a decided ship', () => {
		const viewer = { canOverride: true };
		const revert = { action: 'revert' as const, publicNote: '', auditReason: '', viewer };
		expect(
			overrideProblems({ ...revert, status: 'approved' }).map((problem) => problem.code)
		).toEqual(['publicNoteRequired', 'auditReasonRequired']);
		expect(
			overrideProblems({
				action: 'requeue',
				publicNote: '',
				auditReason: 'Wrong hours',
				status: 'rejected',
				viewer
			})
		).toEqual([]);
		for (const status of ['pending', 'secondpass', 'reverted', 'withdrawn', 'fraudreview']) {
			expect(
				overrideProblems({
					action: 'requeue',
					publicNote: '',
					auditReason: 'Why',
					status,
					viewer
				})[0].message
			).toBe('Only a decided ship can return to the queue.');
		}
		expect(
			overrideProblems({
				action: 'revert',
				publicNote: 'Sorry',
				auditReason: 'Why',
				status: 'pending',
				viewer
			})[0].message
		).toBe('Only a decided ship can be unshipped.');
		expect(
			overrideProblems({
				action: 'revert',
				publicNote: 'Sorry',
				auditReason: 'Why',
				status: 'approved',
				viewer: { canOverride: false }
			})[0].code
		).toBe('overridePermission');
	});
});
