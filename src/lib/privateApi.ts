// public file: describe shapes only, nothing sensitive
import type { RequestEvent } from '@sveltejs/kit';
import type { Component } from 'svelte';
import type { Prisma, ProgramPermission } from '$db';

export interface ShipWarning {
	id: string;
	kind: string;
	severity: 'WARN' | 'DANGER';
	title: string;
	what: string;
	action: string;
	matched: unknown;
	dismissedAt: Date | null;
}

export interface ShipRef {
	submissionId: string;
	programId: string;
}

export interface Viewer {
	userId: string;
	permissions: ProgramPermission[];
}

export interface DecisionGate {
	blocked: boolean;
	message?: string;
}

export interface ExcludedMaker {
	makerId: string;
	reason: string;
}

export type DecisionOutcome = 'final' | 'held' | 'parked';

export interface NavTab {
	href: string;
	label: string;
	icon: string;
	badgeCount?: number;
}

export interface PrivateSlots {
	reviewTiles: Record<
		string,
		{ label: string; icon?: string; component: Component<{ ship: ShipRef }> }
	>;
	settingsCards: {
		id: string;
		// which settings tab shows the card; review when omitted
		tab?: 'general' | 'intake' | 'review' | 'tools' | 'webhooks';
		component: Component<SettingsCardProps>;
	}[];
	// a step records its choices with setValue: they reach programCreated when the program is made
	wizardSteps: {
		id: string;
		label: string;
		description?: string;
		component: Component<WizardStepProps>;
	}[];
	fraudPage?: Component<{ programId: string; view: FraudPageView }>;
	// drawn under the file tree of the review page, with the tracked files the tree leaves out
	reviewFileExtras?: Component<{ ship: ShipRef; files: ReviewFileRow[] }>;
	// drawn after the facts of the project header
	reviewHeaderExtras?: Component<{ ship: ShipRef }>;
	// drawn at the end of the logged time section of the rail
	reviewHoursNotes?: Component<{ ship: ShipRef }>;
	// drawn in the rail between the time and the checklist
	reviewRailExtras?: Component<{ ship: ShipRef }>;
	// drawn over every page while appOverlayData answers; fetched only then
	appOverlay?: () => Promise<{ default: Component<{ data: Record<string, unknown> }> }>;
}

export interface ProjectLink {
	href: string;
	title: string;
}

export interface ActivityDescription {
	detail: string;
	rows: { key: string; value: string }[];
}

export interface WizardStepProps {
	programId?: string;
	values?: Record<string, string>;
	setValue?: (key: string, value: string) => void;
}

export interface ReviewFileRow {
	path: string;
	seconds: number;
	bytes: number | null;
	status: 'head' | 'history' | 'none';
}

export interface SettingsCardProps {
	programId: string;
	// what settingsLoad returned
	data: Record<string, unknown>;
	// the public settings as currently edited, for rules that depend on them
	staged: Record<string, unknown>;
	// changes when the form is saved or discarded: the card drops its own edits
	revision: number;
	// form entries to send with the next save, or null when the card has no edits
	stage: (entries: Record<string, string> | null) => void;
}

export interface SettingsSaveRequest {
	programId: string;
	actor: App.SessionUser;
	form: FormData;
	// the validated public settings about to be written
	next: Record<string, unknown>;
}

export interface SettingsSavePlan {
	// refuses the whole save with this message
	error?: string;
	// merged into the SETTINGS activity event of the save
	changed: string[];
	diff: Record<string, Prisma.InputJsonValue>;
	// extra columns for the program update
	programData: Record<string, unknown>;
	writes: (transaction: Prisma.TransactionClient) => Promise<void>;
	// runs once the save is committed; must not throw
	afterCommit: () => Promise<void>;
}

export type FraudPageView = Record<string, unknown>;

export interface McpCaller {
	user: App.SessionUser;
	tokenId: string;
	tokenLabel: string;
	canWrite: boolean;
}

export interface McpToolLike {
	spec: { name: string; description: string; inputSchema: Record<string, unknown> };
	// write tools are only listed for, and callable by, read-write tokens
	write?: boolean;
	handler: (args: Record<string, unknown>, caller: McpCaller) => Promise<unknown>;
}

export interface ProgramCreatedInput {
	programId: string;
	values: Record<string, string>;
	transaction: Prisma.TransactionClient;
}

export interface PrivateProvider {
	readonly enabled: boolean;
	readonly slots: PrivateSlots;

	// the stored warnings this viewer may see, without running anything
	shipWarnings(ship: ShipRef, viewer: Viewer): Promise<ShipWarning[]>;
	// re-runs the live checks, then answers like shipWarnings. may close the ship
	onShipOpened(ship: ShipRef, viewer: Viewer): Promise<ShipWarning[]>;
	// runs before a decision or a second-pass confirm is recorded
	beforeDecision(ship: ShipRef): Promise<DecisionGate>;
	// makers whose time on this ship counts for nothing. reason finishes a sentence about them
	excludedMakers(ship: ShipRef): Promise<ExcludedMaker[]>;
	routeHeldDecision(
		ship: ShipRef,
		decision: 'approved' | 'changes' | 'rejected'
	): Promise<'secondPass' | 'park'>;
	// runs after the commit and must be retry-safe. outcome is final when omitted
	afterDecision(
		ship: ShipRef,
		decision: 'approved' | 'changes' | 'rejected',
		outcome?: DecisionOutcome
	): Promise<void>;
	// false when the warning does not exist on that ship
	dismissWarning(warningId: string, viewer: Viewer, ship?: ShipRef): Promise<boolean>;
	// keyed by the reviewTiles slot id it feeds. a registered tile with no key here is not for
	// this ship or viewer: it is not drawn, and keeps its place in the saved dock layout
	reviewPanelData(ship: ShipRef, viewer: Viewer): Promise<Record<string, unknown>>;
	programNavTabs(programId: string, viewer: Viewer): Promise<NavTab[]>;
	// null means there is no such page: the route answers 404
	fraudPage(programId: string, viewer: Viewer): Promise<FraudPageView | null>;
	describeAutoReason(reasonCode: string): string | null;
	// the detail of an activity event the public log has no wording for, or null
	describeActivity(kind: string, meta: Record<string, unknown>): ActivityDescription | null;
	// a capture note in plain words, or null to show it as recorded
	describeCaptureNote(note: string): string | null;
	// panels is what reviewPanelData returned; makerId is null on a solo ship. null means no link
	projectLink(
		panels: Record<string, unknown>,
		project: string,
		makerId: string | null
	): ProjectLink | null;
	// an endpoint under the review page, by its path segment. null answers 404
	reviewEndpoint(name: string, event: RequestEvent): Promise<Response | null>;
	// what the appOverlay slot is given. null draws nothing for this user
	appOverlayData(user: App.SessionUser | null): Promise<Record<string, unknown> | null>;
	// an endpoint under /api/private, by its path segment. null answers 404
	appEndpoint(name: string, event: RequestEvent): Promise<Response | null>;
	settingsLoad(programId: string): Promise<Record<string, unknown>>;
	// a card's fields that are absent from the form must be left untouched
	settingsSave(request: SettingsSaveRequest): Promise<SettingsSavePlan>;
	mcpTools(): McpToolLike[];
	// runs inside the create transaction: the returned kinds are listed in the audit event
	programCreated(input: ProgramCreatedInput): Promise<string[]>;
}
