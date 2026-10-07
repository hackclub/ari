import { privateProvider } from '$private';
import { db } from '$lib/server/db';
import { hasPermission } from '$lib/server/authz';
import { viewerOf } from '$lib/server/review/guards';
import { shipAuthorName } from '$lib/server/serialize';
import type { SubmissionStatus, Track } from '$db';
import { programFor, reachablePrograms, shipsWhere, viewableShip } from './access';
import { clampLimit, personInput, personWhere, submissionStatuses, type Tool } from './shared';

export const listSubmissions: Tool = {
	spec: {
		name: 'list_submissions',
		description:
			'List the submissions (ships) you can see in a program, newest first: your tracks only, without your own ships where the program hides them, and without held or fraud-review ships unless you have SECOND_PASS or VIEW_FRAUD. Optionally filter by status and/or track. Returns summary rows; use get_submission for full detail.',
		inputSchema: {
			type: 'object',
			properties: {
				program: { type: 'string', description: 'Program id.' },
				status: {
					type: 'string',
					enum: [...submissionStatuses],
					description: 'Optional status filter.'
				},
				track: { type: 'string', enum: ['software', 'hardware'] },
				limit: { type: 'number', description: 'Max rows (1-100, default 25).' }
			},
			required: ['program'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const program = await programFor(context, args.program);
		const seesFlags = hasPermission(context.user, program.id, 'VIEW_FRAUD');
		const rows = await db.submission.findMany({
			where: {
				...shipsWhere(context, [program]),
				...(args.status ? { status: args.status as SubmissionStatus } : {}),
				...(args.track ? { track: args.track as Track } : {})
			},
			orderBy: { ingestedAt: 'desc' },
			take: clampLimit(args.limit),
			select: {
				id: true,
				title: true,
				status: true,
				track: true,
				version: true,
				claimedHours: true,
				repoUrl: true,
				demoUrl: true,
				receivedAt: true,
				ingestedAt: true,
				authorNameOverrides: true,
				maker: { select: { email: true, name: true, slackId: true } },
				claimedBy: { select: { name: true, email: true } },
				_count: { select: { flags: true } }
			}
		});
		return rows.map((row) => ({
			...row,
			maker: shipAuthorName(row, row.maker),
			makerEmail: row.maker.email,
			makerSlackId: row.maker.slackId,
			claimedBy: row.claimedBy?.name ?? null,
			flags: seesFlags ? row._count.flags : undefined,
			_count: undefined
		}));
	}
};

export const getSubmission: Tool = {
	spec: {
		name: 'get_submission',
		description:
			'Full detail for one submission you can open on the review screen: maker, collaborators, verified-hours breakdown, the warnings you may see, evidence counts, and, with VIEW_REVIEWED, the decision history.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Submission id.' } },
			required: ['id'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const ship = await viewableShip(context, args.id);
		const viewer = viewerOf(context.user, ship.programId);
		const seesHistory = hasPermission(context.user, ship.programId, 'VIEW_REVIEWED');
		const warnings = await privateProvider.shipWarnings(
			{ submissionId: ship.id, programId: ship.programId },
			viewer
		);
		const submission = await db.submission.findUnique({
			where: { id: ship.id },
			include: {
				maker: { select: { email: true, name: true } },
				program: { select: { id: true, name: true } },
				hours: true,
				collaborators: {
					orderBy: { id: 'asc' },
					select: {
						makerId: true,
						hackatimeMinutes: true,
						hackatimeSeconds: true,
						devlogMinutes: true,
						devlogSeconds: true,
						lapseMinutes: true,
						lapseSeconds: true,
						afterLastCommitMinutes: true,
						afterLastCommitSeconds: true,
						programMinutes: true,
						programSeconds: true,
						maker: { select: { email: true, name: true } }
					}
				},
				reviews: {
					orderBy: { createdAt: 'desc' },
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
						reviewer: { select: { name: true, email: true } }
					}
				},
				_count: { select: { commits: true, devlogs: true, clips: true } }
			}
		});
		if (!submission) throw new Error(`No submission with id "${ship.id}".`);
		return {
			...submission,
			reviews: seesHistory ? submission.reviews : undefined,
			flags: warnings.map((warning) => ({
				kind: warning.kind,
				severity: warning.severity,
				title: warning.title,
				what: warning.what,
				action: warning.action,
				dismissedAt: warning.dismissedAt
			})),
			maker: { ...submission.maker, name: shipAuthorName(submission, submission.maker) },
			collaborators: submission.collaborators.map((collaborator) => ({
				...collaborator,
				maker: {
					...collaborator.maker,
					name: shipAuthorName(submission, collaborator.maker)
				}
			})),
			evidence: submission._count,
			_count: undefined
		};
	}
};

export const searchSubmissions: Tool = {
	spec: {
		name: 'search_submissions',
		description:
			'Find submissions you can see whose title, repo URL, maker email, maker name, or maker Slack id contains the query (case-insensitive). Optionally scope to one program.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Substring to match.' },
				program: { type: 'string', description: 'Optional program id.' },
				limit: { type: 'number', description: 'Max rows (1-100, default 25).' }
			},
			required: ['query'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const query = String(args.query);
		const programs = args.program
			? [await programFor(context, args.program)]
			: await reachablePrograms(context);
		return db.submission.findMany({
			where: {
				...shipsWhere(context, programs),
				AND: {
					OR: [
						{ title: { contains: query, mode: 'insensitive' } },
						{ repoUrl: { contains: query, mode: 'insensitive' } },
						{ maker: { email: { contains: query, mode: 'insensitive' } } },
						{ maker: { name: { contains: query, mode: 'insensitive' } } },
						{ maker: { slackId: { contains: query, mode: 'insensitive' } } }
					]
				}
			},
			orderBy: { ingestedAt: 'desc' },
			take: clampLimit(args.limit),
			select: {
				id: true,
				title: true,
				status: true,
				track: true,
				repoUrl: true,
				programId: true,
				maker: { select: { email: true, name: true, slackId: true } }
			}
		});
	}
};

export const submissionEvidence: Tool = {
	spec: {
		name: 'submission_evidence',
		description:
			'The raw evidence captured for a submission you can open: commits (hash, message, author, churn), devlog entries, and elapsed/lapse clips.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Submission id.' },
				limit: { type: 'number', description: 'Max rows per kind (1-100, default 50).' }
			},
			required: ['id'],
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { id } = await viewableShip(context, args.id);
		const take = clampLimit(args.limit, 50);
		const [commits, devlogs, clips] = await Promise.all([
			db.commit.findMany({
				where: { submissionId: id },
				orderBy: { committedAt: 'desc' },
				take,
				select: {
					hash: true,
					message: true,
					committedAt: true,
					additions: true,
					deletions: true,
					authorName: true,
					authorEmail: true
				}
			}),
			db.devlog.findMany({
				where: { submissionId: id },
				orderBy: { at: 'desc' },
				take,
				select: { at: true, minutes: true, seconds: true, text: true, hasImage: true }
			}),
			db.elapsedClip.findMany({
				where: { submissionId: id },
				orderBy: { at: 'desc' },
				take,
				select: { at: true, lengthSeconds: true, note: true, url: true }
			})
		]);
		return { commits, devlogs, clips };
	}
};

export const findMaker: Tool = {
	spec: {
		name: 'find_maker',
		description:
			'Find a maker (ship submitter) by email, Slack id, or name, and list the ships of theirs you can see, both as primary maker and as a collaborator. Makers with no ship you can see are not found. If more than one maker matches (e.g. a name fragment), returns the candidate list instead so you can narrow down.',
		inputSchema: {
			type: 'object',
			properties: {
				...personInput,
				limit: { type: 'number', description: 'Max ships per maker (1-100, default 50).' }
			},
			additionalProperties: false
		}
	},
	handler: async (args, context) => {
		const { conditions } = personWhere(args);
		const programs = await reachablePrograms(context);
		const visible = shipsWhere(context, programs);
		const fraudPrograms = new Set(
			programs
				.filter((program) => hasPermission(context.user, program.id, 'VIEW_FRAUD'))
				.map((program) => program.id)
		);
		const candidates = await db.maker.findMany({
			where: {
				OR: conditions,
				AND: {
					OR: [
						{ submissions: { some: visible } },
						{ collaborations: { some: { submission: visible } } }
					]
				}
			},
			take: 25, // enough candidates to narrow a name fragment, never the whole table
			select: {
				id: true,
				email: true,
				name: true,
				slackId: true,
				hackatimeUserId: true,
				_count: {
					select: {
						submissions: { where: visible },
						collaborations: { where: { submission: visible } }
					}
				}
			}
		});
		if (candidates.length === 0) throw new Error('No maker matches that email, Slack id, or name.');
		if (candidates.length > 1) {
			return {
				matches: candidates.length,
				note: 'Multiple makers matched. Narrow by email or slackId to get ships.',
				candidates: candidates.map((candidate) => ({
					id: candidate.id,
					email: candidate.email,
					name: candidate.name,
					slackId: candidate.slackId,
					ships: candidate._count.submissions,
					collaborations: candidate._count.collaborations
				}))
			};
		}

		const maker = candidates[0];
		const take = clampLimit(args.limit, 50);
		const shipSelect = {
			id: true,
			title: true,
			status: true,
			track: true,
			version: true,
			claimedHours: true,
			repoUrl: true,
			receivedAt: true,
			ingestedAt: true,
			program: { select: { id: true, name: true } },
			_count: { select: { flags: true } }
		} as const;
		const [ships, collaborations] = await Promise.all([
			db.submission.findMany({
				where: { makerId: maker.id, ...visible },
				orderBy: { ingestedAt: 'desc' },
				take,
				select: shipSelect
			}),
			db.submissionCollaborator.findMany({
				where: { makerId: maker.id, submission: visible },
				take,
				select: {
					hackatimeMinutes: true,
					hackatimeSeconds: true,
					devlogMinutes: true,
					devlogSeconds: true,
					lapseMinutes: true,
					lapseSeconds: true,
					submission: { select: shipSelect }
				}
			})
		]);
		const shapeShip = (ship: {
			program: { id: string; name: string };
			_count: { flags: number };
		}) => ({
			...ship,
			program: ship.program.id,
			programName: ship.program.name,
			flags: fraudPrograms.has(ship.program.id) ? ship._count.flags : undefined,
			_count: undefined
		});
		return {
			maker: {
				id: maker.id,
				email: maker.email,
				name: maker.name,
				slackId: maker.slackId,
				hackatimeUserId: maker.hackatimeUserId
			},
			ships: ships.map(shapeShip),
			collaboratorOn: collaborations.map((collaboration) => ({
				...shapeShip(collaboration.submission),
				hackatimeMinutes: collaboration.hackatimeMinutes,
				hackatimeSeconds: collaboration.hackatimeSeconds,
				devlogMinutes: collaboration.devlogMinutes,
				devlogSeconds: collaboration.devlogSeconds,
				lapseMinutes: collaboration.lapseMinutes,
				lapseSeconds: collaboration.lapseSeconds
			}))
		};
	}
};
