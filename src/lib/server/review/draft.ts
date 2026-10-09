import type { Draft } from '$db';
import { draftFromUnknown } from '$lib/review/decisionForm';
import type { Adjustments } from '$lib/review/settlement';
import type { DecisionDraft, FieldValue } from '$lib/review/reviewTypes';
import { toLegacyMinutes } from '$lib/time';
import { canActOnSubmission } from '$lib/server/claims';
import { db } from '$lib/server/db';
import { draftColumns } from '$lib/server/settlementStore';
import { assertCanAct } from '$lib/server/review/guards';
import { storedTimeRequest } from '$lib/server/review/heldReview';

const plainObject = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {};

const sortedJson = (value: Record<string, unknown>): string =>
	JSON.stringify(
		Object.keys(value)
			.sort()
			.map((key) => [key, value[key]])
	);

function minutesOf(adjustments: unknown): Record<string, unknown> {
	const minutes: Record<string, unknown> = {};
	for (const [kind, rows] of Object.entries(plainObject(adjustments))) {
		const kept: Record<string, number> = {};
		for (const [rowId, seconds] of Object.entries(plainObject(rows))) {
			if (typeof seconds === 'number') kept[rowId] = toLegacyMinutes(seconds);
		}
		if (Object.keys(kept).length) minutes[kind] = sortedJson(kept);
	}
	return minutes;
}

function storedMinutes(adjustments: unknown): Record<string, unknown> {
	const minutes: Record<string, unknown> = {};
	for (const [kind, rows] of Object.entries(plainObject(adjustments))) {
		const kept = plainObject(rows);
		if (Object.keys(kept).length) minutes[kind] = sortedJson(kept);
	}
	return minutes;
}

// old ari writes only the minute columns. when they no longer match the seconds beside them,
// the minutes are the newer edit
function secondsAreCurrent(row: Draft): boolean {
	const deflateMatches =
		(row.deflateSeconds === null ? null : toLegacyMinutes(row.deflateSeconds)) ===
		row.deflateMinutes;
	return (
		deflateMatches &&
		sortedJson(minutesOf(row.adjustmentsSeconds)) === sortedJson(storedMinutes(row.adjustments))
	);
}

export function draftFromRow(row: Draft): DecisionDraft {
	const time = storedTimeRequest({
		settlementVersion: secondsAreCurrent(row) ? 3 : 2, // 3 reads the seconds columns, 2 the minutes
		adjustments: row.adjustments,
		deflateMinutes: row.deflateMinutes,
		collaboratorDeflates: row.collaboratorDeflates,
		adjustmentsSeconds: row.adjustmentsSeconds,
		deflateSeconds: row.deflateSeconds,
		collaboratorDeflatesSeconds: row.collaboratorDeflatesSeconds
	});
	return {
		note: row.note,
		audit: row.audit,
		technicalFeatures: row.technicalFeatures,
		deflationReason: row.deflationReason,
		adjustments: time.adjustments as Adjustments,
		deflateSeconds: time.deflateSeconds,
		collaboratorDeflates: time.collaboratorDeflates,
		collaboratorNotes: (row.collaboratorNotes ?? {}) as Record<string, string>,
		fieldValues: (row.fieldValues ?? {}) as Record<string, FieldValue>,
		checks: Array.isArray(row.checks) ? row.checks.map((tick) => tick === true) : [],
		fixChecks: Array.isArray(row.fixChecks)
			? row.fixChecks.filter((id): id is string => typeof id === 'string')
			: []
	};
}

export type DraftSaveResult = { ok: true } | { ok: false; status: number; error: string };

// the endpoint skips the layout load, so access and track scope are enforced here
export async function saveDraft(
	user: App.SessionUser | null,
	programId: string,
	submissionId: string,
	body: unknown
): Promise<DraftSaveResult> {
	if (!user) return { ok: false, status: 401, error: 'unauthorized' };
	// the gate throws like a page would; the endpoint answers json, so its status is carried over
	try {
		await assertCanAct(user, programId, submissionId);
	} catch (caught) {
		const status = (caught as { status?: number }).status;
		if (status === 404) return { ok: false, status, error: 'not_found' };
		if (status === 403) return { ok: false, status, error: 'forbidden' };
		throw caught;
	}
	// only the claim holder builds a decision on an open ship
	if (!(await canActOnSubmission(submissionId, user.id)))
		return { ok: false, status: 409, error: 'locked' };

	const draft = draftFromUnknown(body);
	const collaboratorNotes: Record<string, string> = {};
	for (const [makerId, text] of Object.entries(draft.collaboratorNotes)) {
		if (text.trim()) collaboratorNotes[makerId] = text.slice(0, 10000); // 10,000 characters each
	}
	const data = {
		note: draft.note,
		audit: draft.audit,
		technicalFeatures: draft.technicalFeatures,
		deflationReason: draft.deflationReason,
		// raw requests: clamped against the evidence only at decision time
		...draftColumns({
			adjustments: draft.adjustments,
			deflateSeconds: draft.deflateSeconds,
			collaboratorDeflates: draft.collaboratorDeflates
		}),
		collaboratorNotes,
		fieldValues: draft.fieldValues,
		checks: draft.checks,
		fixChecks: draft.fixChecks
	};
	await db.draft.upsert({
		where: { submissionId_reviewerId: { submissionId, reviewerId: user.id } },
		create: { submissionId, reviewerId: user.id, ...data },
		update: data
	});
	return { ok: true };
}
