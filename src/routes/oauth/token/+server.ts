import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { generateMcpToken } from '$lib/server/mcp/auth';
import { consumeAuthCode, verifyPkce } from '$lib/server/mcp/oauth';
import { mlog, tail4 } from '$lib/server/mcp/log';

const oauthError = (error: string, description: string, status = 400) => {
	mlog('oauth', `token exchange FAILED: ${error}`, { description });
	return json(
		{ error, error_description: description },
		{ status, headers: { 'cache-control': 'no-store' } }
	);
};

function parseBody(rawText: string, contentType: string): URLSearchParams {
	if (!contentType.includes('application/json')) return new URLSearchParams(rawText);
	try {
		const parsed = JSON.parse(rawText) as Record<string, unknown>;
		return new URLSearchParams(
			Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')])
		);
	} catch {
		return new URLSearchParams(rawText);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const contentType = request.headers.get('content-type') ?? '';
	// logged before any parsing so the server log confirms the client reached this endpoint
	mlog('oauth', 'token POST hit', {
		contentType,
		userAgent: request.headers.get('user-agent') ?? ''
	});

	try {
		const rawText = await request.text();
		const params = parseBody(rawText, contentType);
		const param = (key: string) => params.get(key) ?? '';

		mlog('oauth', 'token POST (parsed)', {
			grant_type: param('grant_type'),
			code: tail4(param('code')),
			hasVerifier: !!param('code_verifier'),
			redirect_uri: param('redirect_uri') || '(omitted)',
			client_id: param('client_id') || '(none)',
			bodyLen: rawText.length
		});

		if (param('grant_type') !== 'authorization_code') {
			return oauthError('unsupported_grant_type', 'Only authorization_code is supported.');
		}

		const code = param('code');
		const data = code ? await consumeAuthCode(code) : null;
		if (!data) return oauthError('invalid_grant', 'Authorization code is invalid or expired.');

		if (!param('client_id') || param('client_id') !== data.clientId) {
			return oauthError('invalid_grant', 'client_id does not match the authorization request.');
		}
		if (!param('redirect_uri') || param('redirect_uri') !== data.redirectUri) {
			return oauthError('invalid_grant', 'redirect_uri does not match the authorization request.');
		}
		if (!param('code_verifier')) {
			return oauthError('invalid_request', 'code_verifier is required.');
		}
		if (!verifyPkce(param('code_verifier'), data.codeChallenge)) {
			return oauthError('invalid_grant', 'PKCE verification failed.');
		}

		// the pasted token may have been revoked between consent and exchange
		const parent = data.parentTokenId
			? await db.mcpToken.findUnique({
					where: { id: data.parentTokenId },
					select: { id: true, expiresAt: true, revokedAt: true }
				})
			: null;
		if (data.parentTokenId && (!parent || parent.revokedAt)) {
			return oauthError('invalid_grant', 'The authorizing token is no longer valid.');
		}

		const { raw, hash, last4 } = generateMcpToken();
		let expiresAt = new Date(Date.now() + 7776000000); // 90 days: 90 * 24 * 60 * 60 * 1000
		// a derived token never outlives the one that authorized it
		if (parent?.expiresAt && parent.expiresAt.getTime() < expiresAt.getTime()) {
			expiresAt = parent.expiresAt;
		}
		await db.mcpToken.create({
			data: {
				tokenHash: hash,
				userId: data.userId,
				canWrite: data.canWrite,
				programIds: data.programIds,
				label: 'OAuth connection (claude.ai)',
				last4,
				expiresAt,
				parentTokenId: parent?.id ?? null
			}
		});
		mlog('oauth', 'token exchange OK - minted connection token', {
			token: tail4(raw),
			userId: data.userId,
			canWrite: data.canWrite,
			parentTokenId: parent?.id ?? null,
			expiresAt: expiresAt.toISOString()
		});

		return json(
			{
				access_token: raw,
				token_type: 'Bearer',
				expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)), // ms to seconds
				scope: 'mcp'
			},
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		// clients cannot parse an html 500, so every failure is an oauth json error
		mlog('oauth', 'token exchange threw', { message: (error as Error).message });
		return oauthError('server_error', 'Unexpected server error.', 500);
	}
};

// some clients probe with GET. answered here so it is logged and oauth-shaped
export const GET: RequestHandler = () => {
	mlog('oauth', 'token GET (unexpected) → 405');
	return oauthError('invalid_request', 'Use POST for the token endpoint.', 405);
};
