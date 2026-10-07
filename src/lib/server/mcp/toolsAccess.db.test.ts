import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { privateProvider } from '$private';
import { db } from '$lib/server/db';
import { validateMcpToken, type McpContext } from './auth';
import { dispatch } from './server';
import { mcpTools, toolsFor } from './tools';
import { callTool, mcpFixture, readToolNames, writeToolNames } from './toolsTestFixture';

const fixture = mcpFixture('mcpAccessTest');
const {
	prefix,
	adminId,
	outsiderId,
	programId,
	pendingShipId,
	reviewedShipId,
	adminEmail,
	inviteEmail,
	mintToken
} = fixture;

let readContext: McpContext;
let writeContext: McpContext;
let outsiderToken: string;
const call = <Result = unknown>(
	name: string,
	args: Record<string, unknown>,
	context: McpContext = readContext
) => callTool<Result>(name, args, context);

// request traces, and the enrich enqueue that fails loudly without an ari-webhooks schema
const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
const consoleError = spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
	await fixture.create();
	readContext = await fixture.contextFor(false);
	writeContext = await fixture.contextFor(true);
	outsiderToken = await mintToken(outsiderId, false);
});

afterAll(async () => {
	await fixture.remove();
	consoleLog.mockRestore();
	consoleError.mockRestore();
});

describe('token rules', () => {
	test('any user can hold a token, which acts with exactly their access', async () => {
		const outsider = await validateMcpToken(outsiderToken);
		expect(outsider?.user.id).toBe(outsiderId);
		expect(outsider && (await callTool('list_programs', {}, outsider))).toEqual([]);
		expect(await validateMcpToken('ari_mcp_unknown')).toBeNull();
		expect(await validateMcpToken('not-an-mcp-token')).toBeNull();
		expect(readContext.user.id).toBe(adminId);
		expect(readContext.canWrite).toBe(false);
		expect(writeContext.canWrite).toBe(true);
	});

	test('revoked and expired tokens are refused, and a lost permission is lost to the token at once', async () => {
		const revoked = await mintToken(adminId, false, { revokedAt: new Date() });
		expect(await validateMcpToken(revoked)).toBeNull();

		const expired = await mintToken(adminId, false, {
			expiresAt: new Date(Date.now() - 1000) // 1 second ago
		});
		expect(await validateMcpToken(expired)).toBeNull();

		const live = await mintToken(adminId, false);
		expect((await validateMcpToken(live))?.user.orgPermissions).toContain('MANAGE_PEOPLE');
		const before = fixture.adminPermissions;
		await db.user.update({ where: { id: adminId }, data: { orgPermissions: [] } });
		const narrowed = (await validateMcpToken(live))!;
		expect(narrowed.user.orgPermissions).toEqual([]);
		expect(callTool('list_users', {}, narrowed)).rejects.toThrow(
			'You need the MANAGE_PEOPLE or GRANT_ORG_PERMS org permission.'
		);
		await db.user.update({ where: { id: adminId }, data: { orgPermissions: before } });
	});
});

describe('tool catalogue', () => {
	const privateNames = privateProvider.mcpTools().map((tool) => tool.spec.name);
	const publicSpecs = (canWrite: boolean) =>
		toolsFor(canWrite ? writeContext : readContext)
			.map((tool) => tool.spec)
			.filter((spec) => !privateNames.includes(spec.name));

	test('names and order are the wire contract, and write tools need a read-write token', () => {
		expect(publicSpecs(false).map((spec) => spec.name)).toEqual(readToolNames);
		expect(publicSpecs(true).map((spec) => spec.name)).toEqual([
			...readToolNames,
			...writeToolNames
		]);
		for (const name of readToolNames) expect(mcpTools[name].write).toBeUndefined();
		for (const name of writeToolNames) expect(mcpTools[name].write).toBe(true);
	});

	test('flag tools and detection prose are left to the private provider', () => {
		expect([...readToolNames, ...writeToolNames]).not.toContain('list_flags');
		expect([...readToolNames, ...writeToolNames]).not.toContain('dismiss_flag');
		const prose = JSON.stringify(publicSpecs(true));
		for (const kind of ['DOUBLE_DIP', 'PLAGIARISM', 'PHANTOM_FILES', 'MARATHON_SESSION']) {
			expect(prose).not.toContain(kind);
		}
	});
});

describe('write tools', () => {
	const readOnlyMessage = 'This token is read-only. Mint a read-write token to use write tools.';

	test('a read-only token cannot run any write tool, directly or over json-rpc', async () => {
		const attempts: Record<string, Record<string, unknown>> = {
			add_member: { program: programId, email: inviteEmail },
			remove_member: { program: programId, email: adminEmail },
			set_org_permissions: { email: inviteEmail, permissions: [] },
			requeue_submission: { id: reviewedShipId, auditReason: 'nope' },
			create_program: {
				name: 'nope',
				trackingStartsAt: '2026-01-01',
				reviewersChannel: 'C0000000000'
			},
			update_program: { program: programId, name: 'nope' },
			update_program_settings: { program: programId, name: 'nope' },
			set_review_tools: { program: programId, snippets: [] },
			upload_program_image: {
				program: programId,
				kind: 'icon',
				contentType: 'image/png',
				dataBase64: ''
			},
			roll_ingest_secret: { program: programId },
			roll_outbound_secret: { program: programId }
		};
		for (const name of writeToolNames) {
			expect(call(name, attempts[name])).rejects.toThrow(readOnlyMessage);
			expect(
				await dispatch(
					{
						jsonrpc: '2.0',
						id: 1,
						method: 'tools/call',
						params: { name, arguments: attempts[name] }
					},
					readContext
				)
			).toEqual({
				jsonrpc: '2.0',
				id: 1,
				result: { content: [{ type: 'text', text: `Error: ${readOnlyMessage}` }], isError: true }
			});
		}
		expect(await db.invite.count({ where: { programId } })).toBe(0);
		expect(await db.membership.count({ where: { programId, userId: adminId } })).toBe(1);
		expect((await db.submission.findUniqueOrThrow({ where: { id: reviewedShipId } })).status).toBe(
			'approved'
		);
	});

	test('add_member invites an unknown email once, remove_member revokes it', async () => {
		const args = {
			program: programId,
			email: ` ${inviteEmail.toUpperCase()} `,
			tracks: ['hardware']
		};
		expect(await call('add_member', args, writeContext)).toEqual({
			result: 'invited',
			email: inviteEmail,
			program: programId,
			permissions: [],
			tracks: ['hardware']
		});
		expect((await call<{ result: string }>('add_member', args, writeContext)).result).toBe(
			'already-invited'
		);
		expect(await db.invite.count({ where: { programId, email: inviteEmail } })).toBe(1);
		expect(await call('remove_member', args, writeContext)).toEqual({
			removed: true,
			email: inviteEmail,
			program: programId
		});
		expect(await call('remove_member', args, writeContext)).toEqual({
			removed: false,
			email: inviteEmail,
			program: programId
		});
	});

	test('set_org_permissions needs GRANT_ORG_PERMS on the token owner', async () => {
		expect(
			call('set_org_permissions', { email: inviteEmail, permissions: [] }, writeContext)
		).rejects.toThrow('The token owner does not hold GRANT_ORG_PERMS.');
	});

	test('requeue_submission only rolls back a decided ship, with a reason', async () => {
		expect(
			call('requeue_submission', { id: reviewedShipId, auditReason: ' ' }, writeContext)
		).rejects.toThrow('An internal audit reason is required.');
		expect(
			call('requeue_submission', { id: pendingShipId, auditReason: 'why' }, writeContext)
		).rejects.toThrow('Only a decided ship can return to the queue.');

		expect(
			await call('requeue_submission', { id: reviewedShipId, auditReason: 'why' }, writeContext)
		).toEqual({
			requeued: true,
			id: reviewedShipId,
			program: programId,
			title: `${prefix} reviewed`,
			fromStatus: 'approved',
			toStatus: 'processing'
		});
		expect((await db.submission.findUniqueOrThrow({ where: { id: reviewedShipId } })).status).toBe(
			'processing'
		);
		const event = await db.activityEvent.findFirstOrThrow({
			where: { programId, kind: 'REVERT', submissionId: reviewedShipId }
		});
		expect(event.text).toBe(`Returned ${prefix} reviewed to the queue: why`);
		expect(event.meta).toMatchObject({ op: 'requeued', via: 'mcp', fromStatus: 'approved' });
		expect(await db.review.count({ where: { submissionId: reviewedShipId } })).toBe(1);
	});
});
