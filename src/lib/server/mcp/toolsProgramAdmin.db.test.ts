import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { db } from '$lib/server/db';
import type { McpContext } from './auth';
import { callTool, mcpFixture } from './toolsTestFixture';

const fixture = mcpFixture('mcpProgramAdminTest');
const { prefix, adminId, programId, adminEmail, inviteEmail } = fixture;

let writeContext: McpContext;
let readContext: McpContext;
let creatorContext: McpContext;
const createdIds: string[] = [];
const savedSlackToken = process.env.SLACK_BOT_TOKEN;
const call = <Result = unknown>(
	name: string,
	args: Record<string, unknown>,
	context: McpContext = writeContext
) => callTool<Result>(name, args, context);

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});
const consoleError = spyOn(console, 'error').mockImplementation(() => {});

beforeAll(async () => {
	// creating a program verifies the channel with slack, which is off when there is no token
	process.env.SLACK_BOT_TOKEN = '';
	await fixture.create();
	readContext = await fixture.contextFor(false);
	writeContext = await fixture.contextFor(true);
	// a membership in the fixture program does not make the owner an organizer of it
	await db.user.update({
		where: { id: adminId },
		data: { orgPermissions: ['MANAGE_MCP', 'OPERATE_ALL_PROGRAMS', 'MANAGE_PROGRAMS'] }
	});
	creatorContext = await fixture.contextFor(true);
});

afterAll(async () => {
	if (savedSlackToken === undefined) delete process.env.SLACK_BOT_TOKEN;
	else process.env.SLACK_BOT_TOKEN = savedSlackToken;
	await db.program.deleteMany({ where: { id: { in: createdIds } } });
	await db.invite.deleteMany({ where: { programId: { in: createdIds } } });
	await fixture.remove();
	consoleLog.mockRestore();
	consoleError.mockRestore();
});

describe('program settings tools', () => {
	test('get_program_settings reads in the names update_program_settings takes, with no secret', async () => {
		const read = await call<{
			settings: Record<string, unknown>;
			ingestSecretMasked: string | null;
		}>('get_program_settings', { program: programId }, readContext);
		expect(read.settings).toMatchObject({
			name: prefix,
			evidence: ['commits', 'devlog'],
			secondPass: false,
			outboundEnabled: true
		});
		expect(read.ingestSecretMasked).toBeNull();
	});

	test('update_program_settings changes only what is sent and logs it', async () => {
		const result = await call<{ settings: Record<string, unknown> }>('update_program_settings', {
			program: programId,
			name: `${prefix} renamed`,
			trackingStartsAt: '2026-02-01',
			secondPass: true,
			outboundUrl: 'https://example.com/hook',
			cardBgUrl: 'https://example.com/card.png'
		});
		expect(result.settings).toMatchObject({
			name: `${prefix} renamed`,
			trackingStartsAt: '2026-02-01',
			secondPass: true,
			outboundUrl: 'https://example.com/hook',
			evidence: ['commits', 'devlog'],
			allowDeflation: true
		});
		const program = await db.program.findUniqueOrThrow({ where: { id: programId } });
		expect(program.cardBgUrl).toBe('https://example.com/card.png');
		const event = await db.activityEvent.findFirstOrThrow({
			where: { programId, kind: 'SETTINGS' },
			orderBy: { createdAt: 'desc' }
		});
		expect(event.actorId).toBe(adminId);
		expect(event.meta).toMatchObject({
			changed: expect.arrayContaining(['name', 'second pass review'])
		});
	});

	test('bad input is refused and nothing is written', async () => {
		await expect(
			call('update_program_settings', { program: programId, secondPass: 'yes' })
		).rejects.toThrow('secondPass must be true or false.');
		await expect(
			call('update_program_settings', { program: programId, reviewGoal: 0 })
		).rejects.toThrow('Weekly review goal must be a whole number between 1 and 10000.');
		await expect(
			call('update_program_settings', { program: programId, outboundUrl: 'http://localhost/x' })
		).rejects.toThrow('That webhook host is not allowed.');
		await expect(
			call('update_program_settings', { program: programId, privateSettings: { secondPass: 'on' } })
		).rejects.toThrow('privateSettings.secondPass is a public setting.');
		await expect(
			call('update_program_settings', { program: programId, hoursJustification: false })
		).rejects.toThrow('Hours justification can only be turned off');
		expect(
			(await db.program.findUniqueOrThrow({ where: { id: programId } })).hoursJustification
		).toBe(true);
	});

	test('set_review_tools replaces the lists it is given and leaves the others', async () => {
		await call('set_review_tools', {
			program: programId,
			checklist: [{ label: 'README present' }, { label: 'Demo works', tracks: ['hardware'] }],
			snippets: [{ name: 'Thanks', body: 'Thanks for shipping.' }]
		});
		const first = await call<{
			tools: {
				checklist: { id: string; label: string; tracks: string[] }[];
				snippets: { name: string }[];
			};
		}>('get_program_settings', { program: programId }).then((read) => read.tools);
		expect(first.checklist.map((item) => [item.label, item.tracks])).toEqual([
			['README present', ['software', 'hardware']],
			['Demo works', ['hardware']]
		]);
		expect(first.snippets.map((snippet) => snippet.name)).toEqual(['thanks']);

		const kept = first.checklist[0];
		const second = await call<{ tools: { checklist: { id: string; label: string }[] } }>(
			'set_review_tools',
			{ program: programId, checklist: [{ id: kept.id, label: 'README is present' }] }
		);
		expect(second.tools.checklist).toEqual([
			expect.objectContaining({ id: kept.id, label: 'README is present' })
		]);
		expect(await db.snippet.count({ where: { programId } })).toBe(1);

		await expect(
			call('set_review_tools', { program: programId, snippets: [{ name: 'a', body: ' ' }] })
		).rejects.toThrow('Snippet /a needs text.');
	});

	test('upload_program_image says so when image storage is not configured', async () => {
		await expect(
			call('upload_program_image', {
				program: programId,
				kind: 'icon',
				contentType: 'image/png',
				dataBase64: 'iVBORw0KGgo='
			})
		).rejects.toThrow('Image uploads are not configured yet.');
	});

	test('rolling a secret returns it once and the next read only shows it masked', async () => {
		const rolled = await call<{ secret: string }>('roll_ingest_secret', { program: programId });
		expect(rolled.secret.length).toBeGreaterThan(8);
		const read = await call<{ ingestSecretMasked: string }>(
			'get_program_settings',
			{ program: programId },
			readContext
		);
		expect(read.ingestSecretMasked).toBe(`whsec_••••••••••••${rolled.secret.slice(-4)}`);
		expect(JSON.stringify(read)).not.toContain(rolled.secret);

		const again = await call<{ secret: string }>('roll_ingest_secret', { program: programId });
		expect(again.secret).not.toBe(rolled.secret);
		expect(await db.webhookSecret.count({ where: { programId, revokedAt: null } })).toBe(1);

		const outbound = await call<{ secret: string }>('roll_outbound_secret', { program: programId });
		expect(outbound.secret.length).toBeGreaterThan(8);
		expect(
			JSON.stringify(await db.activityEvent.findMany({ where: { programId, kind: 'SECRET' } }))
		).not.toContain(outbound.secret);
	});
});

describe('program tools', () => {
	const channel = 'C0123456789';

	test('create_program needs CREATE_PROGRAMS or MANAGE_PROGRAMS on the owner', async () => {
		await expect(
			call('create_program', {
				name: `${prefix} no`,
				trackingStartsAt: '2026-01-01',
				reviewersChannel: channel
			})
		).rejects.toThrow('You do not have permission to do this');
	});

	test('create_program makes the program, invites organizers and applies settings', async () => {
		const created = await call<{
			program: string;
			settingsApplied: boolean;
			ingestEndpoint: string | null;
		}>(
			'create_program',
			{
				name: ` ${prefix} created `,
				trackingStartsAt: '2026-03-01',
				reviewersChannel: channel,
				evidence: ['devlog'],
				organizers: [adminEmail, inviteEmail.toUpperCase()],
				poc: adminEmail,
				settings: { iconUrl: 'https://example.com/icon.png', collaborative: true, reviewGoal: 20 }
			},
			creatorContext
		);
		createdIds.push(created.program);
		expect(created.settingsApplied).toBe(true);

		const program = await db.program.findUniqueOrThrow({ where: { id: created.program } });
		expect(program).toMatchObject({
			name: `${prefix} created`,
			accepts: ['devlog'],
			reviewersChannelId: channel,
			iconUrl: 'https://example.com/icon.png',
			collaborative: true,
			weeklyReviewGoal: 20
		});
		expect(program.trackingStartsAt?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
		expect(
			await db.membership.count({
				where: { programId: created.program, userId: adminId, isPoc: true }
			})
		).toBe(1);
		expect(
			await db.invite.count({ where: { programId: created.program, email: inviteEmail } })
		).toBe(1);
		expect(await db.webhookSecret.count({ where: { programId: created.program } })).toBe(1);
	});

	test('create_program reports a settings failure without losing the program', async () => {
		const created = await call<{
			program: string;
			settingsApplied: boolean;
			settingsError: string;
		}>(
			'create_program',
			{
				name: `${prefix} half`,
				trackingStartsAt: '2026-03-01',
				reviewersChannel: channel,
				settings: { reviewGoal: 0 }
			},
			creatorContext
		);
		createdIds.push(created.program);
		expect(created.settingsApplied).toBe(false);
		expect(created.settingsError).toContain('Weekly review goal');
		expect(await db.program.count({ where: { id: created.program } })).toBe(1);
	});

	test('create_program checks its own input', async () => {
		const base = { name: prefix, trackingStartsAt: '2026-03-01', reviewersChannel: channel };
		const refusals: [Record<string, unknown>, string][] = [
			[{ ...base, name: ' ' }, 'A program name is required.'],
			[{ ...base, trackingStartsAt: 'soon' }, 'Tracking start must be a valid date.'],
			[{ ...base, reviewersChannel: 'general' }, 'Reviewers channel must be a Slack channel id'],
			[{ ...base, organizers: ['not-an-email'] }, 'Not an email address: not-an-email.'],
			[{ ...base, evidence: ['video'] }, 'Unknown evidence kinds: video.'],
			[{ ...base, accent: 'red' }, 'accent must be #rrggbb.']
		];
		for (const [args, message] of refusals) {
			await expect(call('create_program', args, creatorContext)).rejects.toThrow(message);
		}
	});

	test('update_program keeps what is not sent and replaces organizers when sent', async () => {
		await call(
			'update_program',
			{ program: programId, name: `${prefix} edited`, accent: '#ec3750' },
			creatorContext
		);
		const program = await db.program.findUniqueOrThrow({ where: { id: programId } });
		expect(program).toMatchObject({ name: `${prefix} edited`, color: '#ec3750', secondPass: true });
		expect(program.accepts).toEqual(['commits', 'devlog']);
		expect(await db.membership.count({ where: { programId, userId: adminId, isPoc: true } })).toBe(
			1
		);

		await call('update_program', { program: programId, organizers: [inviteEmail] }, creatorContext);
		expect(await db.invite.count({ where: { programId, email: inviteEmail } })).toBe(1);
		await call('update_program', { program: programId, organizers: [] }, creatorContext);
		expect(await db.invite.count({ where: { programId, email: inviteEmail } })).toBe(0);
	});
});
