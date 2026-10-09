import { privateProvider } from '$private';
import type { ShipRef, ShipWarning, Viewer } from '$lib/privateApi';
import type { ActionOutcome, LiveChecks, ReviewWarning } from '$lib/review/reviewTypes';
import { canActOnSubmission } from '$lib/server/claims';
import { db } from '$lib/server/db';
import { assertCanAct, done, lockedRefusal, refuse, viewerOf } from '$lib/server/review/guards';

function matchedRows(matched: unknown): { key: string; value: string }[] {
	if (!Array.isArray(matched)) return [];
	return matched.flatMap((entry) => {
		const row = (entry ?? {}) as Record<string, unknown>;
		// rows written before the rename carry k and v
		const key = row.key ?? row.k;
		const value = row.value ?? row.v;
		return typeof key === 'string' ? [{ key, value: String(value ?? '') }] : [];
	});
}

export const warningRows = (warnings: ShipWarning[]): ReviewWarning[] =>
	warnings
		.filter((warning) => !warning.dismissedAt)
		.map((warning) => ({
			id: warning.id,
			kind: warning.kind,
			severity: warning.severity === 'DANGER' ? ('danger' as const) : ('warn' as const),
			title: warning.title,
			what: warning.what,
			action: warning.action,
			matched: matchedRows(warning.matched)
		}));

function withTimeout<Value>(work: Promise<Value>, timeoutMs: number): Promise<Value | null> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), timeoutMs);
		void work
			.then((value) => resolve(value))
			.catch(() => resolve(null))
			.finally(() => clearTimeout(timer));
	});
}

// streamed after first paint: the checks keep running past the bound and land for the next open
export async function runLiveChecks(ship: ShipRef, viewer: Viewer): Promise<LiveChecks> {
	const fresh = await withTimeout(privateProvider.onShipOpened(ship, viewer), 15000); // 15 s: 15 * 1000
	try {
		const after = await db.submission.findUnique({
			where: { id: ship.submissionId },
			select: { status: true }
		});
		return {
			screened: Boolean(after) && after!.status !== 'pending',
			warnings: fresh ? warningRows(fresh) : null
		};
	} catch (caught) {
		// a failed refresh must not break the page already rendered
		console.error(`[review] live check refresh for ${ship.submissionId} failed`, caught);
		return { screened: false, warnings: null };
	}
}

export async function dismissWarning(
	user: App.SessionUser,
	programId: string,
	submissionId: string,
	form: FormData
): Promise<ActionOutcome<{ ok: true }>> {
	const warningId = String(form.get('warningId') ?? form.get('flagId') ?? '');
	if (!warningId) return refuse(400, 'invalid', 'Missing flag id.');
	// the gate already asks SECOND_PASS of a held ship, so only the open statuses remain
	const ship = await assertCanAct(user, programId, submissionId);
	if (ship.status !== 'pending' && ship.status !== 'secondpass')
		return refuse(409, 'shipClosed', 'Only a ship in review can have a flag dismissed.');
	if (!(await canActOnSubmission(submissionId, user.id))) return lockedRefusal();
	const dismissed = await privateProvider.dismissWarning(warningId, viewerOf(user, programId), {
		submissionId,
		programId
	});
	if (!dismissed) return refuse(404, 'notFound', 'Flag not found.');
	return done({ ok: true });
}
