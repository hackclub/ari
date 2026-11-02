import { formatDuration } from '$lib/time';
import {
	confirmProblems,
	decisionProblems,
	type Decision,
	type ReviewProblem,
	type RuleField
} from '$lib/review/reviewRules';
import type { Adjustments } from '$lib/review/settlement';
import type {
	ConfirmResult,
	DecisionDraft,
	DecisionResult,
	DispatchOutcome
} from '$lib/review/reviewTypes';

export type ReviewAction =
	| 'approve'
	| 'changes'
	| 'reject'
	| 'confirm'
	| 'confirmChanges'
	| 'confirmReject';

export const openActions: ReviewAction[] = ['approve', 'changes', 'reject'];

const decisionOfOpenAction = {
	approve: 'approved',
	changes: 'changes',
	reject: 'rejected'
} as const;

export const isConfirmAction = (action: ReviewAction): boolean => action.startsWith('confirm');

// what the action resolves to. a plain confirm ships the held decision
export function decisionOf(action: ReviewAction, heldDecision: Decision | null): Decision {
	if (action === 'confirm') return heldDecision ?? 'approved';
	if (action === 'confirmChanges') return 'changes';
	if (action === 'confirmReject') return 'rejected';
	return decisionOfOpenAction[action];
}

export interface RuleSources {
	status: string;
	hoursJustification: boolean;
	checklistCount: number;
	customFields: RuleField[];
	requiredFixIds: string[];
	draft: DecisionDraft;
	// previewSettlement's answer for the draft, or the held values while a held ship's time is untouched
	settlement: { adjustments: Adjustments };
	deflateSeconds: number | null;
	canAct: boolean;
	canSecondPass: boolean;
	isPoc: boolean;
	held: { decision: Decision; madeByViewer: boolean } | null;
}

// the same lists, in the same order, the server refuses with
export function problemsForAction(action: ReviewAction, sources: RuleSources): ReviewProblem[] {
	const { draft } = sources;
	if (isConfirmAction(action)) {
		const heldDecision = sources.held?.decision ?? 'approved';
		return confirmProblems({
			heldDecision,
			decision: decisionOf(action, heldDecision),
			status: sources.status,
			program: { hoursJustification: sources.hoursJustification },
			notes: {
				note: draft.note,
				technicalFeatures: draft.technicalFeatures,
				deflationReason: draft.deflationReason
			},
			settlement: sources.settlement,
			deflateSeconds: sources.deflateSeconds,
			viewer: {
				canSecondPass: sources.canSecondPass,
				madeHeldDecision: sources.held?.madeByViewer ?? false,
				isPoc: sources.isPoc
			}
		});
	}
	return decisionProblems({
		decision: decisionOf(action, null),
		status: sources.status,
		program: { hoursJustification: sources.hoursJustification },
		checklist: { count: sources.checklistCount, checks: draft.checks },
		fields: { definitions: sources.customFields, values: draft.fieldValues },
		fixes: { requiredIds: sources.requiredFixIds, confirmedIds: draft.fixChecks },
		notes: {
			note: draft.note,
			audit: draft.audit,
			technicalFeatures: draft.technicalFeatures,
			deflationReason: draft.deflationReason
		},
		settlement: sources.settlement,
		deflateSeconds: sources.deflateSeconds,
		viewer: { canAct: sources.canAct }
	});
}

const noteFields = ['note', 'audit', 'technicalFeatures', 'deflationReason'];

// what a first-pass decision of the same kind would still ask of the notes, beyond what the
// confirm enforces. a hint for the organizer, never a refusal
export function confirmNoteGaps(action: ReviewAction, sources: RuleSources): ReviewProblem[] {
	if (!isConfirmAction(action)) return [];
	const { draft } = sources;
	const enforced = problemsForAction(action, sources).map((problem) => problem.field);
	return decisionProblems({
		decision: decisionOf(action, sources.held?.decision ?? 'approved'),
		status: 'pending',
		program: { hoursJustification: sources.hoursJustification },
		checklist: { count: 0, checks: [] },
		fields: { definitions: [], values: {} },
		fixes: { requiredIds: [], confirmedIds: [] },
		notes: {
			note: draft.note,
			audit: draft.audit,
			technicalFeatures: draft.technicalFeatures,
			deflationReason: draft.deflationReason
		},
		settlement: sources.settlement,
		deflateSeconds: sources.deflateSeconds,
		viewer: { canAct: true }
	}).filter((problem) => noteFields.includes(problem.field) && !enforced.includes(problem.field));
}

export interface OutcomeToast {
	tone: 'success' | 'info' | 'error';
	message: string;
}

// null when the program was told, or has no endpoint to tell
export function webhookProblem(outcome: DispatchOutcome | null): string | null {
	if (outcome === null || outcome === 'queued' || outcome === 'noEndpoint') return null;
	const recorded = 'The decision is recorded, but the program was not told: ';
	if (outcome === 'notSigned') return `${recorded}its webhook endpoint has no signing secret.`;
	if (outcome === 'blockedUrl') return `${recorded}its webhook URL is not allowed.`;
	if (outcome === 'noDecision') return `${recorded}there was no decision to send.`;
	return `${recorded}the webhook could not be queued.`;
}

export function decisionToast(result: DecisionResult, title: string): OutcomeToast {
	if (result.outcome === 'held') return { tone: 'info', message: `Held ${title} for second pass` };
	if (result.outcome === 'parked')
		return { tone: 'info', message: `Your decision on ${title} is held for review` };
	if (result.decision === 'approved')
		return {
			tone: 'success',
			message: `Approved ${title} · ${formatDuration(result.approvedSeconds)}`
		};
	if (result.decision === 'changes')
		return { tone: 'info', message: `Sent ${title} back for changes` };
	return { tone: 'error', message: `Rejected ${title}` };
}

const heldNoun = {
	approved: 'approval',
	changes: 'request for changes',
	rejected: 'rejection'
} as const;

export function confirmToast(
	result: ConfirmResult,
	title: string,
	programName: string
): OutcomeToast {
	if (!result.overridden)
		return {
			tone: 'success',
			message: `Confirmed, ${heldNoun[result.decision]} sent to ${programName}`
		};
	if (result.decision === 'approved')
		return {
			tone: 'success',
			message: `Approved ${title} · ${formatDuration(result.approvedSeconds)}`
		};
	if (result.decision === 'changes')
		return { tone: 'info', message: `Sent ${title} back for changes` };
	return { tone: 'error', message: `Rejected ${title}` };
}

const timeKeys = ['adjustments', 'deflateSeconds', 'collaboratorDeflates'];
const reviewerOnlyKeys = ['checks', 'fixChecks'];

// a confirm posts only what the organizer may change. time the organizer did not touch is left
// out so the held values stand exactly as recorded, whichever model recorded them
export function confirmFormBody(
	body: Record<string, string>,
	options: { timeEdited: boolean; decision: Decision | null }
): Record<string, string> {
	const posted: Record<string, string> = {};
	for (const [key, value] of Object.entries(body)) {
		if (reviewerOnlyKeys.includes(key)) continue;
		if (!options.timeEdited && timeKeys.includes(key)) continue;
		posted[key] = value;
	}
	if (options.decision) posted.decision = options.decision;
	return posted;
}
