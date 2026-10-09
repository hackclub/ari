import { db } from '$lib/server/db';
import { shipAuthorName } from '$lib/server/serialize';
import { enqueueJob } from '$lib/server/jobs';
import { dispatchReviewWebhook } from '$lib/server/outbound';
import { teardownVms } from '$lib/server/vm';
import type { SubmissionStatus } from '$db';
import { hasPermission } from '$lib/server/authz';
import { viewableShip } from './access';
import { requireWrite, type Tool } from './shared';

const decidedStatuses: SubmissionStatus[] = ['approved', 'changes', 'rejected'];

export const requeueSubmission: Tool = {
	spec: {
		name: 'requeue_submission',
		description:
			'(write) Return a decided ship (approved, changes, or rejected) to the review queue: the decision is withdrawn, the ship moves to processing with a fresh evidence capture before rejoining the open queue, any reviewer VMs are torn down, and the program is notified via review.requeued so it can undo the original decision (e.g. claw back a payout). The prior Review row stays in the project history. Requires an internal audit reason and OVERRIDE_DECISIONS on the program.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Submission id.' },
				auditReason: {
					type: 'string',
					description:
						'Internal audit reason - the substance of the rollback notice sent to the program.'
				}
			},
			required: ['id', 'auditReason'],
			additionalProperties: false
		}
	},
	write: true,
	handler: async (args, context) => {
		requireWrite(context);
		const { id, programId } = await viewableShip(context, args.id);
		if (!hasPermission(context.user, programId, 'OVERRIDE_DECISIONS')) {
			throw new Error('You need the OVERRIDE_DECISIONS permission on this program.');
		}
		const auditReason = String(args.auditReason ?? '').trim();
		if (!auditReason) throw new Error('An internal audit reason is required.');

		const submission = await db.submission.findUnique({
			where: { id },
			include: { maker: true }
		});
		if (!submission) throw new Error(`No submission with id "${id}".`);
		if (!decidedStatuses.includes(submission.status)) {
			throw new Error('Only a decided ship can return to the queue.');
		}

		const fromStatus = submission.status;

		// read before the rollback deletes the rows, destroyed only once it commits
		const vmids = (
			await db.reviewerVm.findMany({
				where: { submissionId: submission.id },
				select: { vmid: true }
			})
		).map((row) => row.vmid);

		let rolledBack: boolean;
		try {
			rolledBack = await db.$transaction(async (transaction) => {
				// conditional update so a concurrent revert/requeue cannot double-fire.
				// 'processing', not 'pending': the enrich job promotes it once evidence is re-captured
				const updated = await transaction.submission.updateMany({
					where: { id: submission.id, status: { in: decidedStatuses } },
					data: { status: 'processing' }
				});
				if (updated.count === 0) return false;

				await transaction.reviewerVm.deleteMany({ where: { submissionId: submission.id } });

				await transaction.activityEvent.create({
					data: {
						programId: submission.programId,
						kind: 'REVERT',
						actorId: context.user.id,
						submissionId: submission.id,
						text: `Returned ${submission.title} to the queue: ${auditReason}`,
						meta: {
							op: 'requeued',
							via: 'mcp',
							fromStatus,
							toStatus: 'processing',
							title: submission.title,
							maker: shipAuthorName(submission, submission.maker),
							auditReason
						}
					}
				});
				return true;
			});
		} catch (error) {
			// unique violation on the one-open-ship-per-project index
			if ((error as { code?: string })?.code === 'P2002') {
				throw new Error(
					'A newer ship of this project is already open. Decide or unship it before returning this one to the queue.',
					{ cause: error }
				);
			}
			throw error;
		}
		if (!rolledBack) throw new Error('Only a decided ship can return to the queue.');

		// best-effort after commit: a vm or worker outage must not fail the requeue
		teardownVms(vmids);
		void enqueueJob('enrich', submission.id);
		void dispatchReviewWebhook({
			event: 'review.requeued',
			decision: null,
			programId: submission.programId,
			submissionId: submission.id,
			reviewerId: context.user.id,
			note: '',
			auditNote: auditReason
		});

		return {
			requeued: true,
			id: submission.id,
			program: submission.programId,
			title: submission.title,
			fromStatus,
			toStatus: 'processing'
		};
	}
};
