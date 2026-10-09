import { json, type RequestHandler } from '@sveltejs/kit';
import { bearerToken, validateMcpToken } from '$lib/server/mcp/auth';
import { dispatch } from '$lib/server/mcp/server';
import { baseUrl } from '$lib/server/mcp/oauth';
import { mlog, tail4 } from '$lib/server/mcp/log';

// points unauthenticated clients at the metadata that names the authorization server (rfc 9728)
function wwwAuthenticate(origin: string) {
	return {
		'WWW-Authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`
	};
}

export const POST: RequestHandler = async ({ request, url }) => {
	const rawToken = bearerToken(request);
	mlog('api', `POST /api/mcp`, {
		bearer: tail4(rawToken),
		ua: request.headers.get('user-agent') ?? ''
	});
	if (!rawToken) {
		mlog('api', '→ 401 (no bearer)');
		return json(
			{ error: 'missing bearer token' },
			{ status: 401, headers: wwwAuthenticate(baseUrl(url.origin)) }
		);
	}
	const context = await validateMcpToken(rawToken);
	if (!context) {
		mlog('api', '→ 401 (token rejected)', { bearer: tail4(rawToken) });
		return json(
			{ error: 'invalid or non-admin token' },
			{ status: 401, headers: wwwAuthenticate(baseUrl(url.origin)) }
		);
	}
	mlog('api', 'authed', {
		user: context.user.email,
		canWrite: context.canWrite,
		token: context.tokenLabel
	});

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		mlog('api', '→ parse error (bad JSON body)');
		return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
	}

	// batches come from pre-2025-06-18 clients. a batch of only notifications gets a bare 202
	if (Array.isArray(body)) {
		mlog('api', `batch of ${body.length}`);
		const responses = (await Promise.all(body.map((message) => dispatch(message, context)))).filter(
			Boolean
		);
		return responses.length ? json(responses) : new Response(null, { status: 202 });
	}

	const response = await dispatch(body as Record<string, unknown>, context);
	return response ? json(response) : new Response(null, { status: 202 });
};

// stateless mode has nothing to push, so the sse stream a client may open is declined
export const GET: RequestHandler = () => {
	mlog('api', 'GET /api/mcp → 405 (no SSE in stateless mode)');
	return json({ error: 'method not allowed; POST JSON-RPC to this endpoint' }, { status: 405 });
};
