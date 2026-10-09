import type { Adjustments, Evidence, PersonSeconds, SourceSeconds } from '$lib/review/settlement';
import type { Decision, ReviewTrack, RuleFieldType } from '$lib/review/reviewRules';

export type ShipStatus =
	| 'processing'
	| 'pending'
	| 'approved'
	| 'changes'
	| 'rejected'
	| 'reverted'
	| 'withdrawn'
	| 'secondpass'
	| 'fraudreview';

export type FieldValue = string | boolean | string[];

// time is integer seconds
export interface DecisionDraft {
	note: string;
	audit: string;
	technicalFeatures: string;
	deflationReason: string;
	adjustments: Adjustments;
	deflateSeconds: number | null;
	collaboratorDeflates: Record<string, number>;
	collaboratorNotes: Record<string, string>;
	fieldValues: Record<string, FieldValue>;
	checks: boolean[];
	fixChecks: string[];
}

// what the earlier review flow also asked on hardware ships. no review collects these now
export interface EarlierInputs {
	timeEvidence: string;
	supportingEvidence: string;
	hoursReasoning: string;
	additionalJustification: string;
}

export interface RecordedDecision extends DecisionDraft {
	reviewId: string;
	decision: Decision;
	settlementVersion: number;
	// seconds for a version 3 review, legacyMinutes for one the old app recorded
	timeModel: 'seconds' | 'legacyMinutes';
	madeByViewer: boolean;
	reviewerName: string;
	// null unless the review was recorded with any of them
	earlierInputs: EarlierInputs | null;
	decidedAt: string;
	when: string;
	// the stored settlement before the deflate
	approvedSeconds: number;
	// replayed under the model that decided it, after the deflate: what the program is told
	reported: {
		approvedSeconds: number;
		breakdown: SourceSeconds;
		collaborators: Record<string, PersonSeconds>;
	};
}

export interface ReviewShip {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	reviewerNote: string;
	author: string;
	authorSlackId: string | null;
	status: ShipStatus;
	ingestVersion: number;
	version: number;
	track: ReviewTrack;
	repoUrl: string;
	extraRepoUrls: string[];
	demoUrl: string | null;
	thumbnailUrl: string | null;
	meta: Record<string, string | string[]> | null;
	color: string;
	receivedAt: string;
	ago: string;
	priority: boolean;
}

export interface ReviewCollaborator {
	makerId: string;
	name: string;
	slackId: string | null;
	hackatimeUserId: string | null;
	hackatimeSeconds: number;
	devlogSeconds: number;
	lapseSeconds: number;
	afterLastCommitSeconds: number;
	programSeconds: number;
	projects: { name: string; seconds: number }[];
}

export interface ReviewMaker {
	name: string;
	email: string;
	slackId: string | null;
	hackatimeUserId: string | null;
}

export interface CommitPerson {
	label: string;
	slackId: string | null;
	matched: boolean;
}

export interface CommitRow {
	id: string;
	hash: string;
	message: string;
	committedAt: string;
	when: string;
	additions: number;
	deletions: number;
	codingSeconds: number;
	htSeen: boolean;
	makerId: string | null;
	people: CommitPerson[];
}

export interface ClipRow {
	id: string;
	at: string;
	when: string;
	lengthSeconds: number;
	note: string;
	url: string | null;
	thumbnailUrl: string | null;
	makerId: string | null;
	makerName: string | null;
}

export interface DevlogRow {
	id: string;
	at: string;
	when: string;
	seconds: number;
	text: string;
	hasImage: boolean;
	markdown: string;
	makerId: string | null;
	makerName: string | null;
}

export interface FileHour {
	path: string;
	seconds: number;
	bytes: number | null;
	status: 'head' | 'history' | 'none';
}

export interface PastProject {
	recordUrl: string;
	email: string;
	makerName: string | null;
	programs: string[];
	codeUrl: string;
	playableUrl: string;
	description: string;
	screenshotUrl: string;
	hackatimeProjects: string[];
	creditedSeconds: number;
	approvedAt: string | null;
}

export interface ReviewWarning {
	id: string;
	kind: string;
	severity: 'warn' | 'danger';
	title: string;
	what: string;
	action: string;
	matched: { key: string; value: string }[];
}

export interface LiveChecks {
	// the ship left the queue while the checks ran
	screened: boolean;
	// null keeps the warnings already shown
	warnings: ReviewWarning[] | null;
}

export interface FixTarget {
	reviewId: string;
	shipId: string;
	version: number;
	reviewerName: string;
	when: string;
	note: string;
	audit: string | null;
}

export interface ReviewFieldDefinition {
	id: string;
	type: RuleFieldType;
	label: string;
	description: string | null;
	key: string;
	options: string[];
	required: boolean;
}

export interface PastReview {
	reviewId: string;
	shipId: string;
	version: number;
	decision: Decision;
	reviewerName: string;
	reviewerColor: string;
	reviewerSlackId: string | null;
	createdAt: string;
	when: string;
	// null without VIEW_REVIEWED
	approvedSeconds: number | null;
	note: string | null;
	audit: string | null;
	collaboratorNotes: { name: string; note: string }[];
}

export interface ReviewNavigation {
	index: number;
	total: number;
	inQueue: boolean;
	previousId: string | null;
	nextId: string | null;
	track: ReviewTrack | null;
}

export interface ReviewVm {
	vmid: number;
	type: string;
	name: string;
	guacUrl: string;
	rdpUri: string | null;
	rdpPassword: string | null;
	ago: string;
}

export interface ViewerCapabilities {
	// membership or the org operator tier: may claim, draft and decide
	canReview: boolean;
	canSecondPass: boolean;
	canOverride: boolean;
	canUseVms: boolean;
	canViewReviewed: boolean;
	// the tier that skips the second-pass hold when the program allows it
	operatesProgram: boolean;
}

export interface ReviewState {
	decided: boolean;
	// read-only on screen: decided, reverted, withdrawn, held or parked
	closed: boolean;
	secondPass: boolean;
	heldByViewer: boolean;
	canEditHeld: boolean;
	canRevert: boolean;
	canManageVm: boolean;
	canLaunchVm: boolean;
	// which of this viewer's decisions the program would hold for second pass
	holds: Record<Decision, boolean>;
}

export interface ReviewPageData {
	ship: ReviewShip;
	collaborators: ReviewCollaborator[] | null;
	makers: ReviewMaker[];
	authors: { email: string; name: string }[];
	// seconds is null when the ship links several projects and no per-project split is known
	hackatimeProjects: { name: string; seconds: number | null }[];
	// null until a capture recorded per-file time
	fileHours: FileHour[] | null;
	pastProjects: PastProject[];
	evidence: { commits: CommitRow[]; clips: ClipRow[]; devlogs: DevlogRow[] };
	hours: {
		hackatimeSeconds: number;
		devlogSeconds: number;
		lapseSeconds: number;
		afterLastCommitSeconds: number;
		programSeconds: number;
		aiDiscountedSeconds: number;
	};
	// pass to previewSettlement as is
	settlementEvidence: Evidence;
	rules: { hoursJustification: boolean; allowDeflation: boolean };
	update: { message: string } | null;
	warnings: ReviewWarning[];
	liveChecks: Promise<LiveChecks> | null;
	snapshot: {
		version: number;
		synced: boolean;
		syncedAgo: string | null;
		issue: { when: string; notes: string[]; error: string | null; exhausted: boolean } | null;
	};
	checklist: { label: string }[];
	fixes: FixTarget[];
	snippets: { id: string; name: string; body: string }[];
	customFields: ReviewFieldDefinition[];
	pastReviews: PastReview[];
	draft: DecisionDraft | null;
	recorded: RecordedDecision | null;
	lock: { claimable: boolean; mine: boolean; readOnly: boolean; byName: string | null };
	viewer: ViewerCapabilities;
	state: ReviewState;
	reviewGoal: { weekCount: number; goal: number };
	nav: ReviewNavigation;
	vmEnabled: boolean;
	vm: ReviewVm | null;
	// keyed by the private review tile it feeds. empty without the private module
	privatePanels: Record<string, unknown>;
}

export type * from '$lib/review/actionTypes';
export type { Decision, ProblemCode, ReviewProblem, ReviewTrack } from '$lib/review/reviewRules';
export type { Adjustments, Evidence } from '$lib/review/settlement';
