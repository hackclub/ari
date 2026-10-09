import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { db } from '$lib/server/db';
import { loadSettings } from './load';
import {
	revealIngestSecret,
	revealOutboundSecret,
	rollIngestSecret,
	rollOutboundSecret
} from './secrets';
import { formOf, settingsFixtures } from './settingsTestFixtures';
import { archiveProgram, unarchiveProgram } from './status';
import { saveTools } from './tools';
import { sendTestOutbound, sendTestPing } from './webhookTests';

const {
	prefix,
	programId,
	otherProgramId,
	organizer,
	programRow,
	settingsEvents,
	createUsers,
	cleanUp
} = settingsFixtures('settingsToolsTest');

const destination = 'https://hooks.example.test/settings-test?token=abc';

beforeAll(async () => {
	await createUsers();
	await db.program.create({
		data: {
			id: programId,
			name: `${prefix} program`,
			color: '#338eda',
			collaborative: true,
			priorityReview: true,
			outboundEndpoint: { create: { url: destination } }
		}
	});
	await db.program.create({
		data: {
			id: otherProgramId,
			name: `${prefix} other`,
			color: '#338eda',
			checklist: { create: { id: `${prefix}OtherCheck`, order: 0, label: 'Not yours' } }
		}
	});
});

afterAll(cleanUp);

test('reviewer tools are created, updated, reordered and deleted as one set', async () => {
	const firstSave = formOf({
		checklist: JSON.stringify([
			{ id: 'new-1', label: 'Demo works', tracks: ['software'] },
			{ id: 'new-2', label: 'Has a README', tracks: ['software', 'hardware'] }
		]),
		fields: JSON.stringify([
			{
				id: 'new-3',
				type: 'select',
				label: 'Level',
				options: ['Low', 'High'],
				tracks: ['software']
			},
			{ id: 'new-4', type: 'checkbox', label: 'Grand prize', required: true, tracks: ['hardware'] }
		]),
		snippets: JSON.stringify([{ id: 'new-5', name: 'Demo Broken', body: 'The demo is down.' }])
	});
	expect(await saveTools(programId, organizer.id, firstSave)).toEqual({ ok: true });

	const checks = await db.checklistItem.findMany({
		where: { programId },
		orderBy: { order: 'asc' }
	});
	const fields = await db.reviewField.findMany({ where: { programId }, orderBy: { order: 'asc' } });
	const snippets = await db.snippet.findMany({ where: { programId } });
	expect(checks.map((item) => [item.order, item.label, item.tracks])).toEqual([
		[0, 'Demo works', ['software']],
		[1, 'Has a README', ['software', 'hardware']]
	]);
	expect(
		fields.map((field) => [field.order, field.type, field.key, field.options, field.required])
	).toEqual([
		[0, 'select', 'level', ['Low', 'High'], false],
		[1, 'checkbox', 'grand_prize', [], true]
	]);
	expect(snippets.map((snippet) => [snippet.name, snippet.body])).toEqual([
		['demo-broken', 'The demo is down.']
	]);

	const secondSave = formOf({
		checklist: JSON.stringify([
			{ id: checks[1].id, label: 'Has a clear README', tracks: ['hardware'] },
			{ id: `${prefix}OtherCheck`, label: 'Forged', tracks: ['software'] }
		]),
		fields: JSON.stringify([
			{
				id: fields[1].id,
				type: 'checkbox',
				label: 'Grand prize',
				key: 'prize',
				tracks: ['hardware']
			},
			{ id: fields[0].id, type: 'text', label: 'Level', options: ['Low'], tracks: ['software'] }
		]),
		snippets: JSON.stringify([])
	});
	expect(await saveTools(programId, organizer.id, secondSave)).toEqual({ ok: true });

	const nextChecks = await db.checklistItem.findMany({
		where: { programId },
		orderBy: { order: 'asc' }
	});
	expect(nextChecks.map((item) => [item.label, item.tracks])).toEqual([
		['Has a clear README', ['hardware']],
		['Forged', ['software']]
	]);
	expect(nextChecks[0].id).toBe(checks[1].id);
	// an id from another program is never updated: it becomes a new row here
	expect(nextChecks[1].id).not.toBe(`${prefix}OtherCheck`);
	expect(await db.checklistItem.findUnique({ where: { id: `${prefix}OtherCheck` } })).toMatchObject(
		{
			programId: otherProgramId,
			label: 'Not yours'
		}
	);
	const nextFields = await db.reviewField.findMany({
		where: { programId },
		orderBy: { order: 'asc' }
	});
	expect(nextFields.map((field) => [field.id, field.type, field.key, field.options])).toEqual([
		[fields[1].id, 'checkbox', 'prize', []],
		[fields[0].id, 'text', 'level', []]
	]);
	expect(await db.snippet.count({ where: { programId } })).toBe(0);

	const events = (await settingsEvents()).filter(
		(event) => event.text === 'Updated reviewer tools'
	);
	expect(events.map((event) => event.meta)).toEqual([
		{ sub: 'tools', checklist: 2, fields: 2, snippets: 1, added: 5, removed: 0 },
		{ sub: 'tools', checklist: 2, fields: 2, snippets: 0, added: 1, removed: 2 }
	]);
});

test('invalid reviewer tools are refused before anything is written', async () => {
	const duplicateKeys = formOf({
		checklist: '[]',
		fields: JSON.stringify([
			{ label: 'Level', tracks: ['software'] },
			{ label: 'Level', tracks: ['hardware'] }
		]),
		snippets: '[]'
	});
	expect(await saveTools(programId, organizer.id, duplicateKeys)).toEqual({
		ok: false,
		status: 400,
		error: 'Two review fields share the value name "level". Give each its own.'
	});
	expect(await db.checklistItem.count({ where: { programId } })).toBe(2);
});

test('archive and restore log the status change and are no-ops when already there', async () => {
	await archiveProgram(programId, organizer.id);
	await archiveProgram(programId, organizer.id);
	expect((await programRow()).status).toBe('ARCHIVED');
	await unarchiveProgram(programId, organizer.id);
	await unarchiveProgram(programId, organizer.id);
	expect((await programRow()).status).toBe('ACTIVE');
	const events = (await settingsEvents()).filter(
		(event) => (event.meta as { sub?: string }).sub === 'status'
	);
	expect(events.map((event) => [event.text, event.meta])).toEqual([
		[
			`Archived ${prefix} program`,
			{ sub: 'status', op: 'archive', from: 'ACTIVE', to: 'ARCHIVED' }
		],
		[
			`Restored ${prefix} program`,
			{ sub: 'status', op: 'unarchive', from: 'ARCHIVED', to: 'ACTIVE' }
		]
	]);
});

test('rolling a secret revokes the old one, reveals only the new and never logs the plaintext', async () => {
	expect(await revealIngestSecret(programId)).toEqual({
		ok: false,
		status: 400,
		error: 'No signing secret yet. Generate one first.'
	});
	expect(await sendTestPing(programId)).toEqual({
		ok: false,
		status: 400,
		error: 'No signing secret yet. Generate one first.'
	});
	const first = await rollIngestSecret(programId, organizer.id);
	const second = await rollIngestSecret(programId, organizer.id);
	if (!first.ok || !second.ok) throw new Error('roll failed');
	expect(second.plaintext).toMatch(/^whsec_[A-Za-z0-9_-]{32}$/);
	expect(second.plaintext).not.toBe(first.plaintext);
	expect(await revealIngestSecret(programId)).toEqual({ ok: true, plaintext: second.plaintext });
	const stored = await db.webhookSecret.findMany({ where: { programId } });
	expect(
		stored.filter((secret) => secret.revokedAt === null).map((secret) => secret.last4)
	).toEqual([second.plaintext.slice(-4)]);
	expect(stored.some((secret) => secret.secretEnc.includes(second.plaintext))).toBe(false);

	const outbound = await rollOutboundSecret(programId, organizer.id);
	if (!outbound.ok) throw new Error('roll failed');
	expect(await revealOutboundSecret(programId)).toEqual({
		ok: true,
		plaintext: outbound.plaintext
	});
	// rolling keeps the destination saved earlier
	expect(await db.outboundEndpoint.findUnique({ where: { programId } })).toMatchObject({
		url: destination,
		last4: outbound.plaintext.slice(-4)
	});

	const events = await db.activityEvent.findMany({
		where: { programId, kind: 'SECRET' },
		orderBy: { createdAt: 'asc' }
	});
	expect(events.map((event) => event.meta)).toEqual([
		{ scope: 'ingest', op: 'roll', last4: first.plaintext.slice(-4) },
		{ scope: 'ingest', op: 'roll', last4: second.plaintext.slice(-4) },
		{ scope: 'outbound', op: 'roll', last4: outbound.plaintext.slice(-4) }
	]);
	const logged = JSON.stringify(events);
	for (const secret of [first, second, outbound]) expect(logged).not.toContain(secret.plaintext);
	expect((await loadSettings(programId, organizer, 'http://localhost')).webhook).toMatchObject({
		inSecretMasked: `whsec_••••••••••••${second.plaintext.slice(-4)}`,
		outSecretMasked: `whsec_••••••••••••${outbound.plaintext.slice(-4)}`
	});
});

test('a test event is queued with the sentinel ship id and the stored destination', async () => {
	expect(await sendTestOutbound(otherProgramId)).toEqual({
		ok: false,
		status: 400,
		error: 'Set a destination URL first.'
	});
	expect(await sendTestOutbound(programId)).toEqual({ ok: true });
	const deliveries = await db.outboundDelivery.findMany({ where: { programId } });
	expect(deliveries).toHaveLength(1);
	expect(deliveries[0]).toMatchObject({
		event: 'review.approved',
		submissionId: 'TEST-0000',
		url: destination,
		status: 'PENDING'
	});
	const payload = JSON.parse(deliveries[0].payload ?? '{}');
	expect(payload).toMatchObject({ event: 'review.approved', id: 'TEST-0000', priority: true });
	expect(payload.collaborators).toHaveLength(1);
});

test('a test event never goes to a private destination', async () => {
	await db.outboundEndpoint.update({
		where: { programId },
		data: { url: 'http://169.254.169.254/latest' }
	});
	try {
		expect(await sendTestOutbound(programId)).toMatchObject({ ok: false, status: 400 });
		expect(await db.outboundDelivery.count({ where: { programId } })).toBe(1);
	} finally {
		await db.outboundEndpoint.update({ where: { programId }, data: { url: destination } });
	}
});

test('a test ping carries a timestamp and signs timestamp.body with the active secret', async () => {
	const rolled = await rollIngestSecret(programId, organizer.id);
	if (!rolled.ok) throw new Error('roll failed');
	const savedUrl = process.env.WEBHOOKS_URL;
	const realFetch = globalThis.fetch;
	let sent: { url: string; headers: Record<string, string>; body: string } | null = null;
	process.env.WEBHOOKS_URL = 'http://webhooks.test/';
	globalThis.fetch = (async (input: string, init: RequestInit) => {
		sent = {
			url: input,
			headers: init.headers as Record<string, string>,
			body: init.body as string
		};
		return new Response('{}', { status: 200 });
	}) as unknown as typeof fetch;
	try {
		expect(await sendTestPing(programId)).toEqual({ ok: true });
	} finally {
		globalThis.fetch = realFetch;
		if (savedUrl === undefined) delete process.env.WEBHOOKS_URL;
		else process.env.WEBHOOKS_URL = savedUrl;
	}
	if (!sent) throw new Error('nothing was sent');
	const request = sent as { url: string; headers: Record<string, string>; body: string };
	expect(request.url).toBe(`http://webhooks.test/api/ingest/${programId}`);
	const timestamp = request.headers['x-ari-timestamp'];
	expect(timestamp).toMatch(/^\d+$/);
	// 300: the window ari-webhooks accepts, in seconds
	expect(Math.abs(Number(timestamp) - Math.floor(Date.now() / 1000))).toBeLessThan(300);
	expect(request.headers['x-ari-signature']).toBe(
		createHmac('sha256', rolled.plaintext).update(`${timestamp}.${request.body}`).digest('hex')
	);
	expect(JSON.parse(request.body)).toMatchObject({ external_id: 'test-ping' });
});
