import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import type { SubmissionStatus, Track } from '$db';
import { db } from '$lib/server/db';
import { validateMcpToken, type McpContext } from './auth';
import { callTool, mcpFixture } from './toolsTestFixture';

const fixture = mcpFixture('mcpScopeTest');
const { prefix, adminId, programId, pendingShipId, reviewedShipId, mintToken } = fixture;

const otherProgramId = `${prefix}Other`;
const reviewerId = `${prefix}Reviewer`;
const reviewerEmail = `${prefix}reviewer@example.com`.toLowerCase();
const ownMakerId = `${prefix}OwnMaker`;
const hardwareMakerId = `${prefix}HardwareMaker`;
const hardwareMakerEmail = `${prefix}hardware@example.com`.toLowerCase();
const shipIds = {
	hardware: `${prefix}HardwareShip`,
	held: `${prefix}HeldShip`,
	own: `${prefix}OwnShip`,
	other: `${prefix}OtherShip`
};

let reviewer: McpContext;
let reviewerWriter: McpContext;
let limitedAdmin: McpContext;

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
const consoleError = spyOn(console, 'error').mockImplementation(() => {});

const contextOf = async (userId: string, canWrite: boolean, programIds: string[] = []) =>
	(await validateMcpToken(await mintToken(userId, canWrite, { programIds })))!;

const ship = (
	id: string,
	program: string,
	makerId: string,
	track: Track,
	status: SubmissionStatus
) => ({
	id,
	programId: program,
	externalId: id,
	makerId,
	title: `${id} title`,
	repoUrl: `https://example.com/${id}`,
	claimedHours: 1,
	track,
	status,
	receivedAt: new Date('2026-03-01T10:00:00Z'),
	ingestedAt: new Date('2026-03-01T10:00:00Z')
});

beforeAll(async () => {
	await fixture.create();
	await db.program.update({
		where: { id: programId },
		data: { reviewersCannotReviewOwnProjects: true }
	});
	await db.program.create({
		data: { id: otherProgramId, name: `${prefix} other`, color: '#338eda', accepts: ['commits'] }
	});
	await db.user.create({
		data: {
			id: reviewerId,
			email: reviewerEmail,
			name: 'Scope Reviewer',
			avatarColor: '#338eda',
			orgPermissions: []
		}
	});
	await db.membership.create({
		data: { userId: reviewerId, programId, permissions: [], tracks: ['software'] }
	});
	await db.maker.createMany({
		data: [
			{ id: ownMakerId, email: reviewerEmail, name: 'Scope Own Maker' },
			{ id: hardwareMakerId, email: hardwareMakerEmail, name: 'Scope Hardware Maker' }
		]
	});
	await db.submission.createMany({
		data: [
			ship(shipIds.hardware, programId, hardwareMakerId, 'hardware', 'pending'),
			ship(shipIds.held, programId, fixture.makerId, 'software', 'secondpass'),
			ship(shipIds.own, programId, ownMakerId, 'software', 'pending'),
			ship(shipIds.other, otherProgramId, fixture.makerId, 'software', 'pending')
		]
	});
	reviewer = await contextOf(reviewerId, false);
	reviewerWriter = await contextOf(reviewerId, true);
	limitedAdmin = await contextOf(adminId, true, [otherProgramId]);
});

afterAll(async () => {
	await db.submission.deleteMany({ where: { id: { in: Object.values(shipIds) } } });
	await db.maker.deleteMany({ where: { id: { in: [ownMakerId, hardwareMakerId] } } });
	await db.mcpToken.deleteMany({ where: { userId: reviewerId } });
	await db.user.deleteMany({ where: { id: reviewerId } });
	await db.program.deleteMany({ where: { id: otherProgramId } });
	await fixture.remove();
	consoleLog.mockRestore();
	consoleError.mockRestore();
});

describe('a plain reviewer token', () => {
	test('lists only the programs the reviewer belongs to, without the roster size', async () => {
		const programs = await callTool<{ id: string; members: number | null }[]>(
			'list_programs',
			{},
			reviewer
		);
		expect(programs.map((program) => [program.id, program.members])).toEqual([[programId, null]]);
	});

	test('lists only the ships the queue would show them', async () => {
		const rows = await callTool<{ id: string }[]>(
			'list_submissions',
			{ program: programId },
			reviewer
		);
		expect(rows.map((row) => row.id).sort()).toEqual([pendingShipId, reviewedShipId].sort());
		const found = await callTool<{ id: string }[]>(
			'search_submissions',
			{ query: prefix },
			reviewer
		);
		expect(found.map((row) => row.id).sort()).toEqual([pendingShipId, reviewedShipId].sort());
	});

	test('cannot open a ship the review screen would refuse', async () => {
		const refusals: [string, string][] = [
			[shipIds.hardware, 'This ship is outside your review track'],
			[shipIds.held, 'You do not have permission to do this'],
			[shipIds.own, 'You cannot review your own project'],
			[shipIds.other, `No submission with id "${shipIds.other}".`]
		];
		for (const [id, message] of refusals) {
			await expect(callTool('get_submission', { id }, reviewer)).rejects.toThrow(message);
			await expect(callTool('submission_evidence', { id }, reviewer)).rejects.toThrow(message);
		}
		const opened = await callTool<{ id: string; reviews?: unknown }>(
			'get_submission',
			{ id: reviewedShipId },
			reviewer
		);
		expect(opened.id).toBe(reviewedShipId);
		expect(opened.reviews).toBeUndefined();
	});

	test('does not find a maker whose ships are all out of reach', async () => {
		await expect(callTool('find_maker', { email: hardwareMakerEmail }, reviewer)).rejects.toThrow(
			'No maker matches'
		);
	});

	test('a program they are not in reads as missing', async () => {
		await expect(callTool('program_stats', { program: otherProgramId }, reviewer)).rejects.toThrow(
			`No program matches "${otherProgramId}"`
		);
	});

	test('pages behind a permission stay behind it', async () => {
		const refusals: [string, Record<string, unknown>, string][] = [
			['get_program', { program: programId }, 'MANAGE_SETTINGS'],
			['get_program_settings', { program: programId }, 'MANAGE_SETTINGS'],
			['list_activity', { program: programId }, 'VIEW_AUDIT_LOG'],
			['list_reviews', { program: programId }, 'VIEW_REVIEWED'],
			['reviewer_stats', { program: programId, email: reviewerEmail }, 'VIEW_REVIEWERS'],
			['list_users', {}, 'MANAGE_PEOPLE or GRANT_ORG_PERMS'],
			['get_user', { email: reviewerEmail }, 'MANAGE_PEOPLE or GRANT_ORG_PERMS']
		];
		for (const [name, args, permission] of refusals) {
			await expect(callTool(name, args, reviewer)).rejects.toThrow(permission);
		}
	});

	test('writes need the matching permission, and work once it is granted', async () => {
		const refusals: [string, Record<string, unknown>, string][] = [
			['update_program_settings', { program: programId, collaborative: true }, 'MANAGE_SETTINGS'],
			['add_member', { program: programId, email: 'user9@example.com' }, 'MANAGE_REVIEWERS'],
			['requeue_submission', { id: reviewedShipId, auditReason: 'why' }, 'OVERRIDE_DECISIONS'],
			[
				'create_program',
				{ name: 'x', trackingStartsAt: '2026-01-01', reviewersChannel: 'C0123456789' },
				'permission'
			]
		];
		for (const [name, args, message] of refusals) {
			await expect(callTool(name, args, reviewerWriter)).rejects.toThrow(message);
		}
		expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).collaborative).toBe(
			false
		);

		await db.membership.update({
			where: { userId_programId: { userId: reviewerId, programId } },
			data: { permissions: ['MANAGE_SETTINGS'] }
		});
		const granted = await contextOf(reviewerId, true);
		await callTool('update_program_settings', { program: programId, collaborative: true }, granted);
		expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).collaborative).toBe(
			true
		);
	});
});

describe('a token limited to some programs', () => {
	test('reaches only those programs, even for an org operator', async () => {
		const programs = await callTool<{ id: string }[]>('list_programs', {}, limitedAdmin);
		expect(programs.map((program) => program.id)).toEqual([otherProgramId]);
		await expect(
			callTool('list_submissions', { program: programId }, limitedAdmin)
		).rejects.toThrow(`No program matches "${programId}"`);
		await expect(callTool('get_submission', { id: pendingShipId }, limitedAdmin)).rejects.toThrow(
			'No submission with id'
		);
		const found = await callTool<{ id: string }[]>(
			'search_submissions',
			{ query: prefix },
			limitedAdmin
		);
		expect(found.map((row) => row.id)).toEqual([shipIds.other]);
	});

	test('cannot use org-wide tools', async () => {
		const orgWide: [string, Record<string, unknown>][] = [
			['list_users', {}],
			['set_org_permissions', { email: reviewerEmail, permissions: [] }],
			[
				'create_program',
				{ name: 'x', trackingStartsAt: '2026-01-01', reviewersChannel: 'C0123456789' }
			]
		];
		for (const [name, args] of orgWide) {
			await expect(callTool(name, args, limitedAdmin)).rejects.toThrow(
				'This token is limited to some programs'
			);
		}
	});
});
