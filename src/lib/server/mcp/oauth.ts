import { createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { constantTimeEqual } from '$lib/server/constantTimeEqual';
import { mlog, tail4 } from '$lib/server/mcp/log';

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');

// behind a tls-terminating proxy the request origin is the internal one, so BASE_URL wins
export function baseUrl(fallbackOrigin: string): string {
	const configured = env.BASE_URL?.trim().replace(/\/+$/, '');
	return configured || fallbackOrigin;
}

// absolute https, or plain http only for a loopback host. no credentials, no fragment
export function validRedirectUri(raw: unknown): raw is string {
	if (typeof raw !== 'string' || !raw) return false;
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}
	if (parsed.username || parsed.password || parsed.hash || raw.includes('#')) return false;
	if (parsed.protocol === 'https:') return true;
	return (
		parsed.protocol === 'http:' &&
		(parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
	);
}

export interface OauthClient {
	id: string;
	clientName: string;
	redirectUris: string[];
}

export async function findOauthClient(clientId: string): Promise<OauthClient | null> {
	if (!clientId) return null;
	return db.mcpOauthClient.findUnique({
		where: { id: clientId },
		select: { id: true, clientName: true, redirectUris: true }
	});
}

export interface AuthCodeData {
	userId: string;
	clientId: string;
	parentTokenId: string | null;
	canWrite: boolean;
	programIds: string[];
	codeChallenge: string;
	redirectUri: string;
}

export async function issueAuthCode(data: AuthCodeData): Promise<string> {
	const code = randomBytes(32).toString('base64url');
	await db.mcpAuthCode.create({
		data: {
			codeHash: sha256Hex(code),
			userId: data.userId,
			clientId: data.clientId,
			parentTokenId: data.parentTokenId,
			canWrite: data.canWrite,
			programIds: data.programIds,
			codeChallenge: data.codeChallenge,
			redirectUri: data.redirectUri,
			expiresAt: new Date(Date.now() + 300000) // 5 minutes: 5 * 60 * 1000
		}
	});
	mlog('oauth', 'auth code issued', {
		code: tail4(code),
		userId: data.userId,
		clientId: data.clientId,
		canWrite: data.canWrite,
		redirectUri: data.redirectUri,
		hasChallenge: !!data.codeChallenge
	});
	return code;
}

// one-time: the row is deleted before the expiry check
export async function consumeAuthCode(code: string): Promise<AuthCodeData | null> {
	const row = await db.mcpAuthCode.findUnique({ where: { codeHash: sha256Hex(code) } });
	if (!row) {
		mlog('oauth', 'consume: code not found', { code: tail4(code) });
		return null;
	}
	await db.mcpAuthCode.delete({ where: { id: row.id } }).catch(() => {});
	if (row.expiresAt.getTime() < Date.now()) {
		mlog('oauth', 'consume: code expired', { code: tail4(code) });
		return null;
	}
	mlog('oauth', 'consume: ok', { code: tail4(code), userId: row.userId });
	return {
		userId: row.userId,
		clientId: row.clientId,
		parentTokenId: row.parentTokenId,
		canWrite: row.canWrite,
		programIds: row.programIds,
		codeChallenge: row.codeChallenge,
		redirectUri: row.redirectUri
	};
}

export function verifyPkce(verifier: string, challenge: string): boolean {
	if (!verifier || !challenge) {
		mlog('oauth', 'pkce: missing verifier or challenge', {
			hasVerifier: !!verifier,
			hasChallenge: !!challenge
		});
		return false;
	}
	const expected = createHash('sha256').update(verifier).digest('base64url');
	const matches = constantTimeEqual(expected, challenge);
	mlog('oauth', `pkce: ${matches ? 'match' : 'MISMATCH'}`);
	return matches;
}

export function protectedResourceMetadata(origin: string) {
	mlog('oauth', 'discovery: protected-resource', { origin });
	return {
		resource: `${origin}/api/mcp`,
		authorization_servers: [origin]
	};
}

export function authServerMetadata(origin: string) {
	mlog('oauth', 'discovery: authorization-server', { origin });
	return {
		issuer: origin,
		authorization_endpoint: `${origin}/oauth/authorize`,
		token_endpoint: `${origin}/oauth/token`,
		registration_endpoint: `${origin}/oauth/register`,
		response_types_supported: ['code'],
		grant_types_supported: ['authorization_code'],
		code_challenge_methods_supported: ['S256'],
		token_endpoint_auth_methods_supported: ['none'],
		scopes_supported: ['mcp'],
		// strict clients verify the `iss` we echo in the authorization response (rfc 9207)
		authorization_response_iss_parameter_supported: true
	};
}
