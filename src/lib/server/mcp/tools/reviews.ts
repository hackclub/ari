import { db } from '$lib/server/db';
import { programFor, reachablePrograms, shipsWhere } from './access';
import { clampLimit, personInput, personWhere, type Tool } from './shared';

export const listReviews: Tool = {
	spec: {
		name: 'list_reviews',
		description:
			'Recent review decisions (the audit history) on ships you can see, newest first, in programs where you have VIEW_REVIEWED. Filter by program and/or reviewer email.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Optional program id.' },
				reviewerEmail: { type: 'string' },
				limit: { type: 'number', description: 'Max rows (1-100, default 25).' }
			},
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const programs = args.program
			? [await programFor(context, args.program, 'VIEW_REVIEWED')]
			: await reachablePrograms(context, 'VIEW_REVIEWED');
		return db.review.findMany({
			where: {
				submission: shipsWhere(context, programs),
				...(args.reviewerEmail
					? { reviewer: { email: String(args.reviewerEmail).toLowerCase() } }
					: {})
			},
			orderBy: { createdAt: 'desc' },
			take: clampLimit(args.limit),
			select: {
				decision: true,
				noteToMaker: true,
				collaboratorNotes: true,
				auditNote: true,
				technicalFeatures: true,
				deflationReason: true,
				approvedMinutes: true,
				approvedSeconds: true,
				deflateMinutes: true,
				deflateSeconds: true,
				collaboratorDeflates: true,
				collaboratorDeflatesSeconds: true,
				createdAt: true,
				reviewer: { select: { name: true, email: true } },
				submission: { select: { id: true, title: true, programId: true } }
			}
		});
	}
};

export const reviewerStats: Tool = {
	spec: {
		name: 'reviewer_stats',
		description:
			'Review productivity for one reviewer, resolved by email, Slack id, or name: how many submissions they reviewed, broken down by decision and by program, total approved minutes and seconds, and their most recent decisions. Counts only programs where you have VIEW_REVIEWERS. Optionally scope to one program.',
		inputSchema: {
			type: 'object',
			properties: {
				...personInput,
				program: { type: 'string', description: 'Optional program id to scope to.' },
				limit: {
					type: 'number',
					description: 'Max recent decisions returned (1-100, default 10).'
				}
			},
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { conditions } = personWhere(args);
		const programs = args.program
			? [await programFor(context, args.program, 'VIEW_REVIEWERS')]
			: await reachablePrograms(context, 'VIEW_REVIEWERS');
		const programIds = programs.map((program) => program.id);
		// only someone on the roster of a program you can see the reviewers of
		const reviewer = await db.user.findFirst({
			where: { OR: conditions, memberships: { some: { programId: { in: programIds } } } },
			select: { id: true, name: true, email: true, slackId: true, orgPermissions: true }
		});
		if (!reviewer) throw new Error('No reviewer matches that email, Slack id, or name.');
		const where = {
			reviewerId: reviewer.id,
			submission: { programId: { in: programIds } }
		};

		const [decisionGroups, programRows, totals, recent, total] = await Promise.all([
			db.review.groupBy({ by: ['decision'], where, _count: true }),
			db.review.findMany({
				where,
				select: { submission: { select: { program: { select: { id: true } } } } }
			}),
			db.review.aggregate({ where, _sum: { approvedMinutes: true, approvedSeconds: true } }),
			db.review.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				take: clampLimit(args.limit, 10),
				select: {
					decision: true,
					approvedMinutes: true,
					approvedSeconds: true,
					createdAt: true,
					submission: {
						select: { id: true, title: true, program: { select: { id: true } } }
					}
				}
			}),
			db.review.count({ where })
		]);

		const byDecision: Record<string, number> = {};
		for (const group of decisionGroups) byDecision[group.decision] = group._count;
		const byProgram: Record<string, number> = {};
		for (const row of programRows) {
			const rowProgramId = row.submission.program.id;
			byProgram[rowProgramId] = (byProgram[rowProgramId] ?? 0) + 1;
		}

		return {
			reviewer,
			scope: args.program ? String(args.program) : 'all-programs',
			totalReviews: total,
			approvedMinutes: totals._sum.approvedMinutes ?? 0,
			approvedSeconds: totals._sum.approvedSeconds ?? 0,
			byDecision,
			byProgram,
			recentReviews: recent.map((review) => ({
				decision: review.decision,
				approvedMinutes: review.approvedMinutes,
				approvedSeconds: review.approvedSeconds,
				createdAt: review.createdAt,
				submissionId: review.submission.id,
				title: review.submission.title,
				program: review.submission.program.id
			}))
		};
	}
};
