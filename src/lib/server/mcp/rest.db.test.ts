import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { privateProvider } from '$private';
import { db } from '$lib/server/db';
import { buildOpenApi } from './openapi';
import { callToolOverRest } from './rest';
import { mcpFixture, readToolNames, writeToolNames } from './toolsTestFixture';

const fixture = mcpFixture('mcpRestTest');
const { adminId, outsiderId, programId, mintToken } = fixture;

let readToken: string;
let writeToken: string;
let outsiderToken: string;

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});

const post = (name: string, token: string | null, body?: string) =>
	callToolOverRest(
		name,
		new Request(`http://localhost/api/admin/tools/${name}`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(token ? { authorization: `Bearer ${token}` } : {})
			},
			body
		})
	);

beforeAll(async () => {
	await fixture.create();
	readToken = await mintToken(adminId, false);
	writeToken = await mintToken(adminId, true);
	outsiderToken = await mintToken(outsiderId, true);
});

afterAll(async () => {
	await fixture.remove();
	consoleLog.mockRestore();
});

describe('rest tool calls', () => {
	test('a missing or unknown token is a 401', async () => {
		for (const token of [null, 'ari_mcp_unknown']) {
			const response = await post('whoami', token);
			expect(response.status).toBe(401);
		}
	});

	test('a missing permission is a 403, and a program out of reach a 404', async () => {
		const response = await post('list_users', outsiderToken);
		expect(response.status).toBe(403);
		const settings = await post(
			'get_program_settings',
			outsiderToken,
			JSON.stringify({ program: programId })
		);
		expect(settings.status).toBe(404);
		expect(await settings.json()).toEqual({
			error: `No program matches "${programId}" (try list_programs).`
		});
	});

	test('a read tool answers with its result as the body', async () => {
		const response = await post('whoami', readToken);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ canWrite: false });

		const settings = await post(
			'get_program_settings',
			readToken,
			JSON.stringify({ program: programId })
		);
		expect(settings.status).toBe(200);
		expect(await settings.json()).toMatchObject({ program: programId });
	});

	test('a write tool with a read-only token is a 403 and changes nothing', async () => {
		const response = await post(
			'update_program_settings',
			readToken,
			JSON.stringify({ program: programId, name: 'nope' })
		);
		expect(response.status).toBe(403);
		expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).name).not.toBe(
			'nope'
		);
	});

	test('an unknown tool is a 404, and a body that is not an object is a 400', async () => {
		expect((await post('drop_everything', writeToken)).status).toBe(404);
		expect((await post('toString', writeToken)).status).toBe(404);
		expect((await post('whoami', writeToken, '[1]')).status).toBe(400);
		expect((await post('whoami', writeToken, '{nope')).status).toBe(400);
	});

	test('a refused call is a 400 carrying the reason', async () => {
		const response = await post(
			'update_program_settings',
			writeToken,
			JSON.stringify({ program: programId, reviewGoal: 0 })
		);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: 'Weekly review goal must be a whole number between 1 and 10000.'
		});
	});

	test('a write tool with a read-write token runs', async () => {
		const response = await post(
			'update_program_settings',
			writeToken,
			JSON.stringify({ program: programId, collaborative: true })
		);
		expect(response.status).toBe(200);
		expect((await db.program.findUniqueOrThrow({ where: { id: programId } })).collaborative).toBe(
			true
		);
	});
});

describe('openapi document', () => {
	const privateNames = privateProvider.mcpTools().map((tool) => tool.spec.name);
	const document = buildOpenApi('http://localhost');

	test('lists one path per public tool, read and write, in catalogue order', () => {
		expect(Object.keys(document.paths)).toEqual(
			[...readToolNames, ...writeToolNames].map((name) => `/api/admin/tools/${name}`)
		);
	});

	test('leaves out the private provider tools', () => {
		for (const name of privateNames) {
			expect(Object.keys(document.paths)).not.toContain(`/api/admin/tools/${name}`);
		}
	});

	test('each operation takes the tool input schema as its body', () => {
		const operation = document.paths['/api/admin/tools/create_program'].post;
		expect(operation.operationId).toBe('create_program');
		expect(operation.tags).toEqual(['write']);
		expect(operation.requestBody.content['application/json'].schema).toMatchObject({
			required: ['name', 'trackingStartsAt', 'reviewersChannel']
		});
		expect(document.paths['/api/admin/tools/whoami'].post.tags).toEqual(['read']);
		expect(document.servers).toEqual([{ url: 'http://localhost' }]);
	});
});
