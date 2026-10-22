import type { ActionOutcome } from '$lib/review/reviewTypes';
import { db } from '$lib/server/db';
import { assertCanAct, done, refuse } from '$lib/server/review/guards';

export interface ReviewerNoteResult {
	success: true;
}

export async function saveReviewerNote(
	user: App.SessionUser,
	programId: string,
	submissionId: string,
	form: FormData
): Promise<ActionOutcome<ReviewerNoteResult>> {
	await assertCanAct(user, programId, submissionId);
	const raw = String(form.get('reviewerNote') ?? '');
	const reviewerNote = raw.slice(0, 10000); // arbitrary 10k character limit
	const updated = await db.submission.updateMany({
		where: { id: submissionId, programId },
		data: { reviewerNote }
	});
	if (updated.count === 0) return refuse(404, 'notFound', 'Submission not found.');
	return done({ success: true });
}
