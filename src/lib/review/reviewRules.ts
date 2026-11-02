import type { Adjustments } from '$lib/review/settlement';

export type Decision = 'approved' | 'changes' | 'rejected';
export type ReviewTrack = 'software' | 'hardware';
export type RuleFieldType = 'checkbox' | 'text' | 'number' | 'select' | 'multiselect';

export type ProblemCode =
	| 'claimHeldByOther'
	| 'shipClosed'
	| 'noteRequired'
	| 'auditRequired'
	| 'auditTooShort'
	| 'technicalFeaturesRequired'
	| 'fieldRequired'
	| 'checklistIncomplete'
	| 'fixesUnconfirmed'
	| 'deflationReasonRequired'
	| 'notAwaitingSecondPass'
	| 'secondPassPermission'
	| 'ownHeldDecision'
	| 'overrideNoteRequired'
	| 'reasonRequired'
	| 'publicNoteRequired'
	| 'auditReasonRequired'
	| 'overridePermission'
	| 'notDecided';

export interface ReviewProblem {
	code: ProblemCode;
	// the input the reviewer has to fix: a note name, checklist, fixChecks, status, claim,
	// permission, or field:<key> for a custom field
	field: string;
	message: string;
}

export interface RuleField {
	key: string;
	label: string;
	type: RuleFieldType;
	required: boolean;
}

export interface DecisionNotes {
	note: string;
	audit: string;
	technicalFeatures: string;
	deflationReason: string;
}

export interface DecisionRuleInput {
	decision: Decision;
	status: string;
	program: { hoursJustification: boolean };
	checklist: { count: number; checks: unknown };
	fields: { definitions: RuleField[]; values: unknown };
	fixes: { requiredIds: string[]; confirmedIds: unknown };
	notes: DecisionNotes;
	// the settled adjustments and effective deflate, as previewSettlement returns them
	settlement: { adjustments: Adjustments };
	deflateSeconds: number | null;
	viewer: { canAct: boolean };
}

export const auditMinimumLength = (): number => 100; // characters an approval's audit note needs

// surrounding whitespace does not count towards the minimum
export const auditLength = (audit: string): number => audit.trim().length;

// settle only records a row when its settled value is below captured
export function isDeflated(
	adjustments: Adjustments | null | undefined,
	deflateSeconds: number | null | undefined
): boolean {
	if ((deflateSeconds ?? 0) > 0) return true;
	return Object.values(adjustments ?? {}).some(
		(rows) => typeof rows === 'object' && rows !== null && Object.keys(rows).length > 0
	);
}

export function fieldValueMissing(type: RuleFieldType, value: unknown): boolean {
	if (type === 'checkbox') return value !== true;
	if (type === 'multiselect') return !Array.isArray(value) || value.length === 0;
	return value === undefined || value === null || !String(value).trim();
}

export function checklistComplete(count: number, checks: unknown): boolean {
	if (count === 0) return true;
	const ticked = Array.isArray(checks) ? checks : [];
	return ticked.length === count && ticked.every((tick) => tick === true);
}

const stringList = (value: unknown): string[] =>
	Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export function unconfirmedFixIds(requiredIds: string[], confirmedIds: unknown): string[] {
	const confirmed = new Set(stringList(confirmedIds));
	return requiredIds.filter((id) => !confirmed.has(id));
}

const closedMessage = (status: string): string =>
	status === 'fraudreview'
		? 'This ship is under fraud review. No one can act on it until the verdict lands.'
		: 'This ship is no longer open for review.';

function noteProblems(decision: Decision, notes: DecisionNotes): ReviewProblem[] {
	const problems: ReviewProblem[] = [];
	const auditCharacters = auditLength(notes.audit);
	if (!notes.note.trim())
		problems.push({
			code: 'noteRequired',
			field: 'note',
			message: 'A note to the maker is required.'
		});
	if (auditCharacters === 0)
		problems.push({
			code: 'auditRequired',
			field: 'audit',
			message: 'An internal audit note is required.'
		});
	else if (decision === 'approved' && auditCharacters < auditMinimumLength())
		problems.push({
			code: 'auditTooShort',
			field: 'audit',
			message: `Internal audit note must be at least ${auditMinimumLength()} characters for approvals.`
		});
	return problems;
}

const featuresProblem = (): ReviewProblem => ({
	code: 'technicalFeaturesRequired',
	field: 'technicalFeatures',
	message: 'Describe the specific technical features that account for these hours.'
});

const deflationProblem = (): ReviewProblem => ({
	code: 'deflationReasonRequired',
	field: 'deflationReason',
	message: 'Explain why the hours were deflated, or clear the deflation.'
});

// in the order the server reports them: the first problem is the one a refusal names
export function decisionProblems(input: DecisionRuleInput): ReviewProblem[] {
	const problems: ReviewProblem[] = [];
	const approving = input.decision === 'approved';
	const justified = input.program.hoursJustification;

	if (!input.viewer.canAct)
		problems.push({
			code: 'claimHeldByOther',
			field: 'claim',
			message: 'Another reviewer is reviewing this ship.'
		});
	if (input.status !== 'pending')
		problems.push({ code: 'shipClosed', field: 'status', message: closedMessage(input.status) });

	problems.push(...noteProblems(input.decision, input.notes));

	if (approving && justified && !input.notes.technicalFeatures.trim())
		problems.push(featuresProblem());

	if (approving) {
		// sending a ship back or turning it down carries none of the approval-shaped data
		const values = (input.fields.values ?? {}) as Record<string, unknown>;
		for (const definition of input.fields.definitions) {
			if (!definition.required || !fieldValueMissing(definition.type, values[definition.key]))
				continue;
			problems.push({
				code: 'fieldRequired',
				field: `field:${definition.key}`,
				message: `"${definition.label}" is required before approving.`
			});
		}
		if (!checklistComplete(input.checklist.count, input.checklist.checks))
			problems.push({
				code: 'checklistIncomplete',
				field: 'checklist',
				message: 'Complete the approval checklist before approving.'
			});
		if (unconfirmedFixIds(input.fixes.requiredIds, input.fixes.confirmedIds).length)
			problems.push({
				code: 'fixesUnconfirmed',
				field: 'fixChecks',
				message: 'Confirm the latest requested changes were addressed before approving.'
			});
	}

	if (
		justified &&
		isDeflated(input.settlement.adjustments, input.deflateSeconds) &&
		!input.notes.deflationReason.trim()
	)
		problems.push(deflationProblem());

	return problems;
}

export const canDecide = (input: DecisionRuleInput): boolean =>
	decisionProblems(input).length === 0;

export interface ConfirmRuleInput {
	heldDecision: Decision;
	// what the confirm resolves to: the held decision unless the organizer overrides it
	decision: Decision;
	status: string;
	program: { hoursJustification: boolean };
	notes: Pick<DecisionNotes, 'note' | 'technicalFeatures' | 'deflationReason'>;
	settlement: { adjustments: Adjustments };
	deflateSeconds: number | null;
	viewer: { canSecondPass: boolean; madeHeldDecision: boolean; isPoc: boolean };
}

export function confirmProblems(input: ConfirmRuleInput): ReviewProblem[] {
	const problems: ReviewProblem[] = [];
	const justified = input.program.hoursJustification;

	if (!input.viewer.canSecondPass)
		problems.push({
			code: 'secondPassPermission',
			field: 'permission',
			message: 'You do not have permission to do this'
		});
	if (input.status !== 'secondpass')
		problems.push({
			code: 'notAwaitingSecondPass',
			field: 'status',
			message: 'This ship is no longer awaiting second pass.'
		});
	// the poc answers for the program, so there is nobody above them to confirm it
	if (input.viewer.madeHeldDecision && !input.viewer.isPoc)
		problems.push({
			code: 'ownHeldDecision',
			field: 'permission',
			message: 'Your own decision needs a second pair of eyes. Another organizer must confirm it.'
		});
	if (
		input.decision !== input.heldDecision &&
		input.decision !== 'approved' &&
		!input.notes.note.trim()
	)
		problems.push({
			code: 'overrideNoteRequired',
			field: 'note',
			message: 'A note to the maker is required to request changes or reject.'
		});
	if (justified && input.decision === 'approved' && !input.notes.technicalFeatures.trim())
		problems.push(featuresProblem());
	if (
		justified &&
		isDeflated(input.settlement.adjustments, input.deflateSeconds) &&
		!input.notes.deflationReason.trim()
	)
		problems.push(deflationProblem());
	return problems;
}

export const canConfirm = (input: ConfirmRuleInput): boolean => confirmProblems(input).length === 0;

export interface ReturnRuleInput {
	reason: string;
	status: string;
	viewer: { canSecondPass: boolean };
}

export function returnProblems(input: ReturnRuleInput): ReviewProblem[] {
	const problems: ReviewProblem[] = [];
	if (!input.viewer.canSecondPass)
		problems.push({
			code: 'secondPassPermission',
			field: 'permission',
			message: 'You do not have permission to do this'
		});
	if (!input.reason.trim())
		problems.push({
			code: 'reasonRequired',
			field: 'reason',
			message: 'A reason is required to send a ship back to the queue.'
		});
	if (input.status !== 'secondpass')
		problems.push({
			code: 'notAwaitingSecondPass',
			field: 'status',
			message: 'This ship is no longer awaiting second pass.'
		});
	return problems;
}

const decidedStatuses = ['approved', 'changes', 'rejected'];
export const isDecided = (status: string): boolean => decidedStatuses.includes(status);

export interface OverrideRuleInput {
	action: 'revert' | 'requeue';
	publicNote: string;
	auditReason: string;
	status: string;
	viewer: { canOverride: boolean };
}

export function overrideProblems(input: OverrideRuleInput): ReviewProblem[] {
	const problems: ReviewProblem[] = [];
	if (!input.viewer.canOverride)
		problems.push({
			code: 'overridePermission',
			field: 'permission',
			message: 'You do not have permission to do this'
		});
	if (input.action === 'revert' && !input.publicNote.trim())
		problems.push({
			code: 'publicNoteRequired',
			field: 'publicNote',
			message: 'A message to the maker is required.'
		});
	if (!input.auditReason.trim())
		problems.push({
			code: 'auditReasonRequired',
			field: 'auditReason',
			message: 'An internal audit reason is required.'
		});
	if (!isDecided(input.status))
		problems.push({
			code: 'notDecided',
			field: 'status',
			message:
				input.action === 'revert'
					? 'Only a decided ship can be unshipped.'
					: 'Only a decided ship can return to the queue.'
		});
	return problems;
}

// per-person notes: unknown people and blank notes are dropped, the shared note covers them
export function collaboratorNotesFor(
	raw: unknown,
	knownMakerIds: string[]
): Record<string, string> {
	const notes: Record<string, string> = {};
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return notes;
	const known = new Set(knownMakerIds);
	for (const [makerId, value] of Object.entries(raw)) {
		if (!known.has(makerId) || typeof value !== 'string') continue;
		const text = value.trim().slice(0, 10000); // 10,000 characters per person
		if (text) notes[makerId] = text;
	}
	return notes;
}
