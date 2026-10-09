import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import type { McpContext } from './auth';
import { callTool, keysOf, mcpFixture } from './toolsTestFixture';

const fixture = mcpFixture('mcpReadTest');
const {
	prefix,
	adminId,
	programId,
	makerId,
	pendingShipId,
	reviewedShipId,
	adminEmail,
	makerEmail,
	receivedAt,
	reviewedAt
} = fixture;

let readContext: McpContext;
const call = <Result = unknown>(name: string, args: Record<string, unknown> = {}) =>
	callTool<Result>(name, args, readContext);

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});

beforeAll(async () => {
	await fixture.create();
	readContext = await fixture.contextFor(false);
});

afterAll(async () => {
	await fixture.remove();
	consoleLog.mockRestore();
});

describe('read tools', () => {
	test('list_programs', async () => {
		const programs = await call<Record<string, unknown>[]>('list_programs');
		const program = programs.find((entry) => entry.id === programId)!;
		expect(program).toEqual({
			id: programId,
			name: prefix,
			status: 'ACTIVE',
			accepts: ['commits', 'devlog'],
			collaborative: false,
			allowVms: false,
			secondPass: false,
			weeklyReviewGoal: 50,
			members: 1,
			pending: 1
		});
	});

	test('program_stats', async () => {
		expect(await call('program_stats', { program: programId })).toEqual({
			program: { id: programId, name: prefix, status: 'ACTIVE' },
			submissionsByStatus: {
				pending: 1,
				approved: 1,
				changes: 0,
				rejected: 0,
				reverted: 0,
				processing: 0,
				withdrawn: 0,
				secondpass: 0
			},
			total: 2,
			members: 1,
			operators: 1,
			poc: adminEmail
		});
		expect(call('program_stats', { program: `${prefix}Missing` })).rejects.toThrow(
			`No program matches "${prefix}Missing" (try list_programs).`
		);
	});

	test('list_submissions', async () => {
		const rows = await call<Record<string, unknown>[]>('list_submissions', { program: programId });
		expect(rows.map((row) => row.id)).toEqual([reviewedShipId, pendingShipId]);
		expect(JSON.parse(JSON.stringify(rows[1]))).toEqual({
			id: pendingShipId,
			title: `${prefix} pending`,
			status: 'pending',
			track: 'software',
			version: 1,
			claimedHours: 5,
			repoUrl: 'https://example.com/pending',
			demoUrl: null,
			receivedAt: receivedAt.toISOString(),
			ingestedAt: receivedAt.toISOString(),
			authorNameOverrides: null,
			maker: 'Mcp Maker',
			claimedBy: null,
			makerEmail,
			makerSlackId: `${prefix}MakerSlack`,
			flags: 0
		});
		const approved = await call<unknown[]>('list_submissions', {
			program: programId,
			status: 'approved',
			limit: 1
		});
		expect(approved).toHaveLength(1);
	});

	test('get_submission', async () => {
		const pending = JSON.parse(JSON.stringify(await call('get_submission', { id: pendingShipId })));
		expect(keysOf(pending)).toEqual([
			'acceptedEvidence',
			'aiCheckRanAt',
			'aiCheckResult',
			'authorNameOverrides',
			'claimedAt',
			'claimedById',
			'claimedHours',
			'collaborators',
			'demoUrl',
			'description',
			'enrichmentVersion',
			'evidence',
			'evidenceSyncedAt',
			'externalId',
			'flags',
			'hackatimeProjects',
			'hours',
			'id',
			'ingestVersion',
			'ingestedAt',
			'isUpdate',
			'maker',
			'makerId',
			'priority',
			'program',
			'programId',
			'programMeta',
			'queuedAt',
			'receivedAt',
			'repoUrl',
			'reviews',
			'status',
			'thumbnailUrl',
			'title',
			'track',
			'updateMessage',
			'version'
		]);
		expect(pending.maker).toEqual({ email: makerEmail, name: 'Mcp Maker' });
		expect(pending.program).toEqual({ id: programId, name: prefix });
		expect(pending.evidence).toEqual({ commits: 1, devlogs: 1, clips: 0 });
		expect(pending.flags).toEqual([]);
		expect(pending.collaborators).toEqual([]);
		expect(pending.hours).toMatchObject({
			submissionId: pendingShipId,
			hackatimeMinutes: 200,
			hackatimeSeconds: 12000,
			devlogMinutes: 90,
			devlogSeconds: 5400,
			lapseMinutes: 15,
			lapseSeconds: 900,
			afterLastCommitMinutes: 0,
			afterLastCommitSeconds: 0,
			programMinutes: 0,
			programSeconds: 0
		});

		const reviewed = JSON.parse(
			JSON.stringify(await call('get_submission', { id: reviewedShipId }))
		);
		expect(reviewed.reviews).toEqual([
			{
				decision: 'approved',
				noteToMaker: 'Nice work',
				collaboratorNotes: {},
				auditNote: 'checked the repo',
				technicalFeatures: '',
				deflationReason: '',
				approvedMinutes: 170,
				approvedSeconds: 10200,
				deflateMinutes: 10,
				deflateSeconds: 600,
				collaboratorDeflates: null,
				collaboratorDeflatesSeconds: null,
				createdAt: reviewedAt.toISOString(),
				reviewer: { name: 'Mcp Admin', email: adminEmail }
			}
		]);
		expect(call('get_submission', { id: `${prefix}Missing` })).rejects.toThrow(
			`No submission with id "${prefix}Missing".`
		);
	});

	test('list_reviews', async () => {
		const rows = JSON.parse(
			JSON.stringify(await call('list_reviews', { program: programId, reviewerEmail: adminEmail }))
		);
		expect(rows).toEqual([
			{
				decision: 'approved',
				noteToMaker: 'Nice work',
				collaboratorNotes: {},
				auditNote: 'checked the repo',
				technicalFeatures: '',
				deflationReason: '',
				approvedMinutes: 170,
				approvedSeconds: 10200,
				deflateMinutes: 10,
				deflateSeconds: 600,
				collaboratorDeflates: null,
				collaboratorDeflatesSeconds: null,
				createdAt: reviewedAt.toISOString(),
				reviewer: { name: 'Mcp Admin', email: adminEmail },
				submission: { id: reviewedShipId, title: `${prefix} reviewed`, programId }
			}
		]);
	});

	test('list_users', async () => {
		const users = await call<Record<string, unknown>[]>('list_users', {
			withOrgPermissions: true
		});
		const admin = users.find((user) => user.id === adminId)!;
		expect(keysOf(admin)).toEqual([
			'email',
			'id',
			'lastSeenAt',
			'memberships',
			'name',
			'orgPermissions',
			'slackId'
		]);
		expect(admin.memberships).toEqual([
			{ program: programId, permissions: ['VIEW_REVIEWED'], isPoc: true, tracks: ['software'] }
		]);
		expect(admin.orgPermissions).toEqual(['MANAGE_MCP', 'MANAGE_PEOPLE', 'OPERATE_ALL_PROGRAMS']);
	});

	test('search_submissions', async () => {
		const rows = await call<unknown[]>('search_submissions', {
			query: `${prefix} PENDING`,
			program: programId
		});
		expect(rows).toEqual([
			{
				id: pendingShipId,
				title: `${prefix} pending`,
				status: 'pending',
				track: 'software',
				repoUrl: 'https://example.com/pending',
				programId,
				maker: { email: makerEmail, name: 'Mcp Maker', slackId: `${prefix}MakerSlack` }
			}
		]);
		expect(await call<unknown[]>('search_submissions', { query: makerEmail })).toHaveLength(2);
	});

	test('whoami', async () => {
		expect(await call('whoami')).toEqual({
			id: adminId,
			name: 'Mcp Admin',
			email: adminEmail,
			orgPermissions: ['MANAGE_MCP', 'MANAGE_PEOPLE', 'OPERATE_ALL_PROGRAMS'],
			memberships: [
				{ programId, permissions: ['VIEW_REVIEWED'], isPoc: true, tracks: ['software'] }
			],
			token: `${prefix} false`,
			canWrite: false,
			programIds: []
		});
	});

	test('get_user', async () => {
		const user = JSON.parse(JSON.stringify(await call('get_user', { email: adminEmail })));
		expect(keysOf(user)).toEqual([
			'email',
			'id',
			'lastSeenAt',
			'memberships',
			'name',
			'orgPermissions',
			'recentReviews',
			'slackId',
			'totalReviews'
		]);
		expect(user.totalReviews).toBe(1);
		expect(user.memberships).toEqual([
			{
				program: programId,
				programName: prefix,
				permissions: ['VIEW_REVIEWED'],
				isPoc: true,
				tracks: ['software']
			}
		]);
		expect(user.recentReviews).toEqual([
			{
				decision: 'approved',
				approvedMinutes: 170,
				approvedSeconds: 10200,
				createdAt: reviewedAt.toISOString(),
				submission: { id: reviewedShipId, title: `${prefix} reviewed` }
			}
		]);
		expect(call('get_user', {})).rejects.toThrow(
			'Provide at least one of email, slackId, or name.'
		);
	});

	test('get_program', async () => {
		expect(await call('get_program', { program: programId })).toEqual({
			id: programId,
			name: prefix,
			status: 'ACTIVE',
			accepts: ['commits', 'devlog'],
			weeklyReviewGoal: 50,
			collaborative: false,
			allowVms: false,
			secondPass: false,
			checklist: [],
			reviewFields: [],
			flagRules: [],
			outbound: { configured: false },
			counts: { memberships: 1, submissions: 2, snippets: 0 }
		});
	});

	test('list_activity', async () => {
		const events = JSON.parse(JSON.stringify(await call('list_activity', { program: programId })));
		expect(events).toContainEqual({
			kind: 'APPROVED',
			text: 'Approved the reviewed ship',
			createdAt: reviewedAt.toISOString(),
			submissionId: reviewedShipId
		});
	});

	test('submission_evidence', async () => {
		const evidence = JSON.parse(
			JSON.stringify(await call('submission_evidence', { id: pendingShipId }))
		);
		expect(evidence).toEqual({
			commits: [
				{
					hash: 'abc1234',
					message: 'first commit',
					committedAt: receivedAt.toISOString(),
					additions: 10,
					deletions: 2,
					authorName: 'Mcp Maker',
					authorEmail: makerEmail
				}
			],
			devlogs: [
				{
					at: receivedAt.toISOString(),
					minutes: 90,
					seconds: 5400,
					text: 'built the thing',
					hasImage: false
				}
			],
			clips: []
		});
	});

	test('find_maker', async () => {
		const found = JSON.parse(JSON.stringify(await call('find_maker', { email: makerEmail })));
		expect(keysOf(found)).toEqual(['collaboratorOn', 'maker', 'ships']);
		expect(found.maker).toEqual({
			id: makerId,
			email: makerEmail,
			name: 'Mcp Maker',
			slackId: `${prefix}MakerSlack`,
			hackatimeUserId: null
		});
		expect(found.collaboratorOn).toEqual([]);
		expect(found.ships).toHaveLength(2);
		expect(found.ships[1]).toEqual({
			id: pendingShipId,
			title: `${prefix} pending`,
			status: 'pending',
			track: 'software',
			version: 1,
			claimedHours: 5,
			repoUrl: 'https://example.com/pending',
			receivedAt: receivedAt.toISOString(),
			ingestedAt: receivedAt.toISOString(),
			program: programId,
			programName: prefix,
			flags: 0
		});
	});

	test('reviewer_stats', async () => {
		const stats = JSON.parse(
			JSON.stringify(await call('reviewer_stats', { slackId: `${prefix}Slack` }))
		);
		expect(stats).toEqual({
			reviewer: {
				id: adminId,
				name: 'Mcp Admin',
				email: adminEmail,
				slackId: `${prefix}Slack`,
				orgPermissions: ['MANAGE_MCP', 'MANAGE_PEOPLE', 'OPERATE_ALL_PROGRAMS']
			},
			scope: 'all-programs',
			totalReviews: 1,
			approvedMinutes: 170,
			approvedSeconds: 10200,
			byDecision: { approved: 1 },
			byProgram: { [programId]: 1 },
			recentReviews: [
				{
					decision: 'approved',
					approvedMinutes: 170,
					approvedSeconds: 10200,
					createdAt: reviewedAt.toISOString(),
					submissionId: reviewedShipId,
					title: `${prefix} reviewed`,
					program: programId
				}
			]
		});
	});
});
