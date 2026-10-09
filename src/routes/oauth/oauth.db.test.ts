import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '$lib/server/db';
import { hashMcpToken, validateMcpToken } from '$lib/server/mcp/auth';
import { baseUrl, issueAuthCode } from '$lib/server/mcp/oauth';
import { descendantTokenIds, revokeTokenTree } from '$lib/server/mcp/tokenLineage';
import { mcpFixture } from '$lib/server/mcp/toolsTestFixture';
import { actions as authorizeActions, load as authorizeLoad } from './authorize/+page.server';
import { POST as registerPost } from './register/+server';
import { POST as tokenPost } from './token/+server';

const fixture = mcpFixture('oauthFlowTest');
const { prefix, adminId, mintToken } = fixture;
const origin = 'http://ari.test';
const redirectUri = `https://client.example/${prefix}/callback`;
const otherRedirectUri = `https://client.example/${prefix}/other`;

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});

let clientId = '';
let adminToken = '';
let adminTokenId = '';

const tokenIdOf = async (raw: string) =>
	(await db.mcpToken.findUniqueOrThrow({ where: { tokenHash: hashMcpToken(raw) } })).id;

const jsonRequest = (path: string, body: unknown) =>
	new Request(`${origin}${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

const register = async (body: unknown) => {
	const response = await registerPost({ request: jsonRequest('/oauth/register', body) } as never);
	return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

function pkcePair() {
	const verifier = randomBytes(32).toString('base64url');
	const challenge = createHash('sha256').update(verifier).digest('base64url');
	return { verifier, challenge };
}

const authorizeParams = (overrides: Record<string, string> = {}) => ({
	client_id: clientId,
	redirect_uri: redirectUri,
	response_type: 'code',
	state: 'xyz',
	code_challenge: pkcePair().challenge,
	code_challenge_method: 'S256',
	scope: 'mcp',
	resource: `${origin}/api/mcp`,
	...overrides
});

const loadConsent = (params: Record<string, string>) =>
	authorizeLoad({
		url: new URL(`${origin}/oauth/authorize?${new URLSearchParams(params)}`)
	} as never) as Promise<{ params: unknown; client: { name: string; redirectHost: string } }>;

async function loadFails(params: Record<string, string>): Promise<string> {
	try {
		await loadConsent(params);
	} catch (thrown) {
		const httpError = thrown as { status: number; body: { message: string } };
		expect(httpError.status).toBe(400);
		return httpError.body.message;
	}
	throw new Error('expected the consent load to reject');
}

async function consent(params: Record<string, string>, token: string): Promise<unknown> {
	const form = new FormData();
	for (const [key, value] of Object.entries({ ...params, token })) form.set(key, value);
	const request = new Request(`${origin}/oauth/authorize`, { method: 'POST', body: form });
	try {
		return await authorizeActions.default({
			request,
			url: new URL(`${origin}/oauth/authorize`)
		} as never);
	} catch (thrown) {
		return thrown;
	}
}

// runs the consent step and returns the code it redirected with
async function issueCode(params: Record<string, string>, token = adminToken): Promise<string> {
	const result = (await consent(params, token)) as { status: number; location: string };
	expect(result.status).toBe(303);
	const destination = new URL(result.location);
	expect(destination.origin + destination.pathname).toBe(redirectUri);
	expect(destination.searchParams.get('state')).toBe(params.state ?? 'xyz');
	expect(destination.searchParams.get('iss')).toBe(baseUrl(origin));
	return destination.searchParams.get('code') ?? '';
}

async function exchange(body: Record<string, string>) {
	const request = new Request(`${origin}/oauth/token`, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(body).toString()
	});
	const response = await tokenPost({ request } as never);
	return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const exchangeBody = (code: string, verifier: string, overrides: Record<string, string> = {}) => ({
	grant_type: 'authorization_code',
	code,
	code_verifier: verifier,
	redirect_uri: redirectUri,
	client_id: clientId,
	...overrides
});

beforeAll(async () => {
	await fixture.create();
	const registered = await register({
		client_name: `${prefix} client`,
		redirect_uris: [redirectUri, otherRedirectUri]
	});
	expect(registered.status).toBe(201);
	clientId = String(registered.body.client_id);
	adminToken = await mintToken(adminId, false);
	adminTokenId = await tokenIdOf(adminToken);
});

afterAll(async () => {
	await db.mcpOauthClient.deleteMany({ where: { clientName: { startsWith: prefix } } });
	await fixture.remove();
	consoleLog.mockRestore();
});

describe('dynamic client registration', () => {
	test('persists the client and answers with the rfc 7591 shape', async () => {
		const registered = await register({
			client_name: `${prefix} second`,
			redirect_uris: ['http://localhost:4242/cb']
		});
		expect(registered.status).toBe(201);
		expect(registered.body).toMatchObject({
			client_name: `${prefix} second`,
			redirect_uris: ['http://localhost:4242/cb'],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code']
		});
		expect(typeof registered.body.client_id_issued_at).toBe('number');
		const row = await db.mcpOauthClient.findUnique({
			where: { id: String(registered.body.client_id) }
		});
		expect(row?.redirectUris).toEqual(['http://localhost:4242/cb']);
	});

	test('rejects missing, excessive, insecure and credentialed redirect uris and long names', async () => {
		expect((await register({})).status).toBe(400);
		expect((await register({ redirect_uris: [] })).status).toBe(400);
		expect((await register({ redirect_uris: ['http://example.com/cb'] })).status).toBe(400);
		expect((await register({ redirect_uris: ['https://u:p@example.com/cb'] })).status).toBe(400);
		expect((await register({ redirect_uris: ['https://example.com/cb', 7] })).status).toBe(400);
		const eleven = [...Array(11).keys()].map((index) => `https://example.com/cb${index}`);
		expect((await register({ redirect_uris: eleven })).status).toBe(400);
		const longName = await register({
			client_name: 'n'.repeat(101),
			redirect_uris: ['https://example.com/cb']
		});
		expect(longName.status).toBe(400);
		expect(longName.body.error).toBe('invalid_client_metadata');
		const malformed = await registerPost({
			request: new Request(`${origin}/oauth/register`, { method: 'POST', body: '{nope' })
		} as never);
		expect(malformed.status).toBe(400);
	});

	test('refuses once 100 clients were registered in the last hour', async () => {
		await db.mcpOauthClient.createMany({
			data: [...Array(100).keys()].map((index) => ({
				clientName: `${prefix} bulk ${index}`,
				redirectUris: ['https://example.com/cb']
			}))
		});
		const refused = await register({ redirect_uris: ['https://example.com/cb'] });
		expect(refused.status).toBe(429);
		await db.mcpOauthClient.deleteMany({ where: { clientName: { startsWith: `${prefix} bulk` } } });
	});
});

describe('authorize', () => {
	test('shows the client name and redirect host for a valid request', async () => {
		const consentPage = await loadConsent(authorizeParams());
		expect(consentPage.client).toEqual({
			name: `${prefix} client`,
			redirectHost: 'client.example'
		});
	});

	test('rejects an unknown client, an unregistered redirect_uri and weak or missing pkce', async () => {
		expect(await loadFails(authorizeParams({ client_id: '' }))).toMatch(/client_id/);
		expect(await loadFails(authorizeParams({ client_id: `${clientId}x` }))).toMatch(/Unknown/);
		expect(await loadFails(authorizeParams({ redirect_uri: '' }))).toMatch(/redirect_uri/);
		expect(await loadFails(authorizeParams({ redirect_uri: `${redirectUri}/` }))).toMatch(
			/not registered/
		);
		expect(
			await loadFails(authorizeParams({ redirect_uri: 'https://evil.example/callback' }))
		).toMatch(/not registered/);
		expect(await loadFails(authorizeParams({ code_challenge: '' }))).toMatch(/PKCE/);
		expect(await loadFails(authorizeParams({ code_challenge_method: 'plain' }))).toMatch(/S256/);
		expect(await loadFails(authorizeParams({ code_challenge_method: '' }))).toMatch(/S256/);
		expect(await loadFails(authorizeParams({ response_type: 'token' }))).toMatch(/response_type/);
		// a missing response_type is read as code
		expect((await loadConsent(authorizeParams({ response_type: '' }))).client.name).toBe(
			`${prefix} client`
		);
	});

	test('the consent post applies the same checks before looking at the token', async () => {
		const result = (await consent(
			authorizeParams({ redirect_uri: 'https://evil.example/cb' }),
			adminToken
		)) as {
			status: number;
		};
		expect(result.status).toBe(400);
		expect(await db.mcpAuthCode.count({ where: { clientId } })).toBe(0);
	});

	test('a bad token re-renders with an error and issues nothing', async () => {
		const result = (await consent(authorizeParams(), 'ari_mcp_nope')) as {
			status: number;
			data: { error: string; client: { name: string } };
		};
		expect(result.status).toBe(400);
		expect(result.data.error).toMatch(/invalid/);
		expect(result.data.client.name).toBe(`${prefix} client`);
		expect(await db.mcpAuthCode.count({ where: { clientId } })).toBe(0);
	});

	test('a valid token redirects with a code bound to the client and the pasted token', async () => {
		const { challenge } = pkcePair();
		await issueCode(authorizeParams({ code_challenge: challenge }));
		const row = await db.mcpAuthCode.findFirstOrThrow({ where: { clientId } });
		expect(row.parentTokenId).toBe(adminTokenId);
		expect(row.redirectUri).toBe(redirectUri);
		expect(row.codeChallenge).toBe(challenge);
		await db.mcpAuthCode.delete({ where: { id: row.id } });
	});
});

describe('token exchange', () => {
	test('rejects a missing verifier, a wrong verifier, wrong redirect_uri and wrong client_id', async () => {
		for (const [overrides, error] of [
			[{ code_verifier: '' }, 'invalid_request'],
			[{ code_verifier: 'not-the-verifier' }, 'invalid_grant'],
			[{ redirect_uri: '' }, 'invalid_grant'],
			[{ redirect_uri: otherRedirectUri }, 'invalid_grant'],
			[{ client_id: '' }, 'invalid_grant'],
			[{ client_id: `${clientId}x` }, 'invalid_grant']
		] as const) {
			const { verifier, challenge } = pkcePair();
			const code = await issueCode(authorizeParams({ code_challenge: challenge }));
			const result = await exchange(exchangeBody(code, verifier, overrides));
			expect([result.status, result.body.error]).toEqual([400, error]);
			// the code is burnt by the failed attempt
			const retry = await exchange(exchangeBody(code, verifier));
			expect(retry.body.error).toBe('invalid_grant');
		}
	});

	test('a code stored without a challenge can never be exchanged', async () => {
		const code = await issueAuthCode({
			userId: adminId,
			clientId,
			parentTokenId: adminTokenId,
			canWrite: false,
			programIds: [],
			codeChallenge: '',
			redirectUri
		});
		const result = await exchange(exchangeBody(code, 'anything'));
		expect([result.status, result.body.error]).toEqual([400, 'invalid_grant']);
	});

	test('mints a token derived from the pasted one, capped at its expiry', async () => {
		const parentExpiry = new Date(Date.now() + 86400000); // 1 day: 24 * 60 * 60 * 1000
		const parentToken = await mintToken(adminId, true, { expiresAt: parentExpiry });
		const parentId = await tokenIdOf(parentToken);
		const { verifier, challenge } = pkcePair();
		const code = await issueCode(authorizeParams({ code_challenge: challenge }), parentToken);
		const result = await exchange(exchangeBody(code, verifier));
		expect(result.status).toBe(200);
		expect(result.body.token_type).toBe('Bearer');
		expect(Number(result.body.expires_in)).toBeLessThanOrEqual(86400); // 1 day: 24 * 60 * 60
		const minted = await db.mcpToken.findUniqueOrThrow({
			where: { tokenHash: hashMcpToken(String(result.body.access_token)) }
		});
		expect(minted.parentTokenId).toBe(parentId);
		expect(minted.canWrite).toBe(true);
		expect(minted.expiresAt?.getTime()).toBe(parentExpiry.getTime());
		expect((await validateMcpToken(String(result.body.access_token)))?.user.id).toBe(adminId);
	});

	test('a parent revoked between consent and exchange blocks the exchange', async () => {
		const parentToken = await mintToken(adminId, false);
		const { verifier, challenge } = pkcePair();
		const code = await issueCode(authorizeParams({ code_challenge: challenge }), parentToken);
		await db.mcpToken.update({
			where: { tokenHash: hashMcpToken(parentToken) },
			data: { revokedAt: new Date() }
		});
		const result = await exchange(exchangeBody(code, verifier));
		expect([result.status, result.body.error]).toEqual([400, 'invalid_grant']);
	});

	test('an unknown grant type or a bad code is an oauth error, not a 500', async () => {
		expect((await exchange({ grant_type: 'client_credentials' })).body.error).toBe(
			'unsupported_grant_type'
		);
		expect((await exchange(exchangeBody('nope', 'nope'))).body.error).toBe('invalid_grant');
	});
});

describe('token lineage', () => {
	test('revoking a parent revokes every derived token, however deep', async () => {
		const rootId = await tokenIdOf(await mintToken(adminId, false));
		const childId = await tokenIdOf(await mintToken(adminId, false, { parentTokenId: rootId }));
		const grandchildId = await tokenIdOf(
			await mintToken(adminId, false, { parentTokenId: childId })
		);
		const unrelatedId = await tokenIdOf(await mintToken(adminId, false));
		expect((await descendantTokenIds(rootId)).sort()).toEqual([childId, grandchildId].sort());

		await revokeTokenTree(rootId);
		const rows = await db.mcpToken.findMany({
			where: { id: { in: [rootId, childId, grandchildId, unrelatedId] } },
			select: { id: true, revokedAt: true }
		});
		const revoked = rows.filter((row) => row.revokedAt).map((row) => row.id);
		expect(revoked.sort()).toEqual([rootId, childId, grandchildId].sort());
	});
});
