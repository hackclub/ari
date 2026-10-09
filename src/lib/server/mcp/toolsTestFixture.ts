import type { OrgPermission } from '$db';
import { db } from '$lib/server/db';
import { generateMcpToken, validateMcpToken, type McpContext } from './auth';
import { mcpTools } from './tools';

export function mcpFixture(label: string) {
	const prefix = `${label}${Date.now()}${Math.floor(Math.random() * 1000000)}`;
	const adminId = `${prefix}Admin`;
	const outsiderId = `${prefix}Outsider`;
	const programId = `${prefix}Program`;
	const makerId = `${prefix}Maker`;
	const pendingShipId = `${prefix}PendingShip`;
	const reviewedShipId = `${prefix}ReviewedShip`;
	const adminEmail = `${adminId}@example.com`.toLowerCase();
	const makerEmail = `${makerId}@example.com`.toLowerCase();
	const inviteEmail = `${prefix}invitee@example.com`.toLowerCase();
	const receivedAt = new Date('2026-03-01T10:00:00Z');
	const adminPermissions: OrgPermission[] = ['MANAGE_MCP', 'MANAGE_PEOPLE', 'OPERATE_ALL_PROGRAMS'];
	const reviewedAt = new Date('2026-03-02T10:00:00Z');

	async function mintToken(userId: string, canWrite: boolean, extra: object = {}): Promise<string> {
		const { raw, hash, last4 } = generateMcpToken();
		await db.mcpToken.create({
			data: { tokenHash: hash, userId, canWrite, label: `${prefix} ${canWrite}`, last4, ...extra }
		});
		return raw;
	}

	const contextFor = async (canWrite: boolean): Promise<McpContext> =>
		(await validateMcpToken(await mintToken(adminId, canWrite)))!;

	async function create(): Promise<void> {
		await db.user.createMany({
			data: [
				{
					id: adminId,
					email: adminEmail,
					name: 'Mcp Admin',
					avatarColor: '#338eda',
					slackId: `${prefix}Slack`,
					orgPermissions: adminPermissions
				},
				{
					id: outsiderId,
					email: `${outsiderId}@example.com`.toLowerCase(),
					name: 'Mcp Outsider',
					avatarColor: '#338eda',
					orgPermissions: ['MANAGE_MCP']
				}
			]
		});
		await db.program.create({
			data: { id: programId, name: prefix, color: '#338eda', accepts: ['commits', 'devlog'] }
		});
		await db.membership.create({
			data: { userId: adminId, programId, permissions: ['VIEW_REVIEWED'], isPoc: true }
		});
		await db.maker.create({
			data: { id: makerId, email: makerEmail, name: 'Mcp Maker', slackId: `${prefix}MakerSlack` }
		});
		await db.submission.createMany({
			data: [
				{
					id: pendingShipId,
					programId,
					externalId: pendingShipId,
					makerId,
					title: `${prefix} pending`,
					repoUrl: 'https://example.com/pending',
					claimedHours: 5,
					receivedAt,
					ingestedAt: receivedAt
				},
				{
					id: reviewedShipId,
					programId,
					externalId: reviewedShipId,
					makerId,
					title: `${prefix} reviewed`,
					repoUrl: 'https://example.com/reviewed',
					claimedHours: 3,
					status: 'approved',
					receivedAt,
					ingestedAt: new Date('2026-03-01T11:00:00Z')
				}
			]
		});
		await db.hoursBreakdown.create({
			data: {
				submissionId: pendingShipId,
				hackatimeMinutes: 200,
				devlogMinutes: 90,
				lapseMinutes: 15,
				hackatimeSeconds: 12000, // 200 * 60
				devlogSeconds: 5400, // 90 * 60
				lapseSeconds: 900 // 15 * 60
			}
		});
		await db.commit.create({
			data: {
				submissionId: pendingShipId,
				hash: 'abc1234',
				message: 'first commit',
				committedAt: receivedAt,
				additions: 10,
				deletions: 2,
				authorName: 'Mcp Maker',
				authorEmail: makerEmail
			}
		});
		await db.devlog.create({
			data: {
				submissionId: pendingShipId,
				at: receivedAt,
				minutes: 90,
				seconds: 5400, // 90 * 60
				text: 'built the thing',
				markdown: 'built the thing'
			}
		});
		await db.review.create({
			data: {
				submissionId: reviewedShipId,
				reviewerId: adminId,
				decision: 'approved',
				noteToMaker: 'Nice work',
				auditNote: 'checked the repo',
				fieldValues: {},
				checklist: {},
				approvedMinutes: 170,
				deflateMinutes: 10,
				approvedSeconds: 10200, // 170 * 60
				deflateSeconds: 600, // 10 * 60
				createdAt: reviewedAt
			}
		});
		await db.activityEvent.create({
			data: {
				programId,
				kind: 'APPROVED',
				actorId: adminId,
				submissionId: reviewedShipId,
				text: 'Approved the reviewed ship',
				createdAt: reviewedAt
			}
		});
	}

	async function remove(): Promise<void> {
		await Bun.sleep(200); // lets the fire-and-forget enrich job and webhook lookups settle
		await db.$executeRaw`delete from ariw.job where "submissionId" in (${pendingShipId}, ${reviewedShipId})`.catch(
			() => {}
		);
		await db.invite.deleteMany({ where: { programId } });
		await db.review.deleteMany({
			where: { submissionId: { in: [pendingShipId, reviewedShipId] } }
		});
		await db.submission.deleteMany({ where: { id: { in: [pendingShipId, reviewedShipId] } } });
		await db.program.deleteMany({ where: { id: programId } });
		await db.maker.deleteMany({ where: { id: makerId } });
		await db.user.deleteMany({ where: { id: { in: [adminId, outsiderId] } } });
	}

	return {
		prefix,
		adminPermissions,
		adminId,
		outsiderId,
		programId,
		makerId,
		pendingShipId,
		reviewedShipId,
		adminEmail,
		makerEmail,
		inviteEmail,
		receivedAt,
		reviewedAt,
		mintToken,
		contextFor,
		create,
		remove
	};
}

export const callTool = <Result = unknown>(
	name: string,
	args: Record<string, unknown>,
	context: McpContext
) => mcpTools[name].handler(args, context) as Promise<NoInfer<Result>>;

export const keysOf = (value: object) => Object.keys(value).sort();

export const readToolNames = [
	'list_programs',
	'program_stats',
	'list_submissions',
	'get_submission',
	'list_reviews',
	'list_users',
	'search_submissions',
	'whoami',
	'get_user',
	'get_program',
	'list_activity',
	'submission_evidence',
	'find_maker',
	'reviewer_stats',
	'get_program_settings'
];
export const writeToolNames = [
	'add_member',
	'remove_member',
	'set_org_permissions',
	'requeue_submission',
	'create_program',
	'update_program',
	'update_program_settings',
	'set_review_tools',
	'upload_program_image',
	'roll_ingest_secret',
	'roll_outbound_secret'
];
