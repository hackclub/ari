import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { db } from '$lib/server/db';
import { validateMcpToken, type McpContext } from './auth';
import { publicTools } from './tools';
import { toolError } from './tools/shared';
import { mcpFixture } from './toolsTestFixture';

const fixture = mcpFixture('mcpReachTest');
const {
	prefix,
	adminId,
	outsiderId,
	programId,
	pendingShipId,
	reviewedShipId,
	adminEmail,
	makerEmail,
	inviteEmail,
	mintToken
} = fixture;
const otherProgramId = `${prefix}Other`;

// every public tool aimed at the fixture program, which neither caller below may reach
const attempts: Record<string, Record<string, unknown>> = {
	whoami: {},
	list_programs: {},
	program_stats: { program: programId },
	get_program: { program: programId },
	get_program_settings: { program: programId },
	list_activity: { program: programId },
	list_submissions: { program: programId },
	get_submission: { id: pendingShipId },
	search_submissions: { query: prefix },
	submission_evidence: { id: pendingShipId },
	find_maker: { email: makerEmail },
	list_reviews: {},
	reviewer_stats: { email: adminEmail },
	list_users: {},
	get_user: { email: adminEmail },
	add_member: { program: programId, email: inviteEmail },
	remove_member: { program: programId, email: adminEmail },
	set_org_permissions: { email: adminEmail, permissions: [] },
	requeue_submission: { id: reviewedShipId, auditReason: 'out of reach' },
	create_program: {
		name: `${prefix} new`,
		trackingStartsAt: '2026-01-01',
		reviewersChannel: 'C0123456789'
	},
	update_program: { program: programId, name: 'renamed' },
	update_program_settings: { program: programId, name: 'renamed' },
	set_review_tools: { program: programId, snippets: [{ name: 'leak', body: 'leak' }] },
	upload_program_image: {
		program: programId,
		kind: 'icon',
		contentType: 'image/png',
		dataBase64: 'iVBORw0KGgo='
	},
	roll_ingest_secret: { program: programId },
	roll_outbound_secret: { program: programId }
};

const reachMarkers = [
	programId,
	pendingShipId,
	reviewedShipId,
	makerEmail,
	adminEmail,
	inviteEmail
];

let callers: [string, McpContext][];

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
const consoleError = spyOn(console, 'error').mockImplementation(() => {});

const snapshot = async () =>
	JSON.stringify(
		await Promise.all([
			db.program.findUnique({ where: { id: programId } }),
			db.membership.findMany({ where: { programId }, orderBy: { id: 'asc' } }),
			db.invite.findMany({ where: { programId }, orderBy: { id: 'asc' } }),
			db.webhookSecret.findMany({ where: { programId }, orderBy: { id: 'asc' } }),
			db.outboundEndpoint.findMany({ where: { programId } }),
			db.snippet.findMany({ where: { programId } }),
			db.submission.findMany({ where: { programId }, orderBy: { id: 'asc' } }),
			db.program.count({ where: { name: `${prefix} new` } }),
			db.user.findMany({ where: { id: { in: [adminId, outsiderId] } }, orderBy: { id: 'asc' } })
		])
	);

beforeAll(async () => {
	await fixture.create();
	await db.program.create({
		data: { id: otherProgramId, name: `${prefix} other`, color: '#338eda', accepts: ['commits'] }
	});
	const contextOf = async (userId: string, programIds: string[]) =>
		(await validateMcpToken(await mintToken(userId, true, { programIds })))!;
	callers = [
		['a token whose owner cannot open the program', await contextOf(outsiderId, [])],
		['an org admin token limited to another program', await contextOf(adminId, [otherProgramId])]
	];
});

afterAll(async () => {
	await db.program.deleteMany({
		where: { OR: [{ id: otherProgramId }, { name: `${prefix} new` }] }
	});
	await fixture.remove();
	consoleLog.mockRestore();
	consoleError.mockRestore();
});

describe('nothing out of reach leaks through any tool', () => {
	test('every public tool is covered here', () => {
		expect(publicTools.map((tool) => tool.spec.name).sort()).toEqual(Object.keys(attempts).sort());
	});

	test('each call is refused or answers without a trace, and changes nothing', async () => {
		const before = await snapshot();
		for (const [who, context] of callers) {
			for (const tool of publicTools) {
				let answer: string;
				try {
					answer = JSON.stringify(await tool.handler(attempts[tool.spec.name], context));
				} catch (caught) {
					answer = toolError(caught).message;
				}
				// a refusal may repeat what the caller sent, never anything else
				const sent = JSON.stringify(attempts[tool.spec.name]) + context.user.email;
				for (const marker of reachMarkers.filter((entry) => !sent.includes(entry))) {
					expect({ who, tool: tool.spec.name, leaked: answer.includes(marker) }).toEqual({
						who,
						tool: tool.spec.name,
						leaked: false
					});
				}
			}
		}
		expect(await snapshot()).toEqual(before);
	});
});
