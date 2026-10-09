import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { validRedirectUri } from '$lib/server/mcp/oauth';
import { mlog } from '$lib/server/mcp/log';

const registrationError = (error: string, description: string, status = 400) => {
	mlog('oauth', `register REJECTED: ${error}`, { description });
	return json({ error, error_description: description }, { status });
};

// public client (pkce, no secret): the registered redirect uris are what binds a code to it
export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return registrationError('invalid_client_metadata', 'Body must be a JSON object.');
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return registrationError('invalid_client_metadata', 'Body must be a JSON object.');
	}

	const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
	if (redirectUris.length === 0 || redirectUris.length > 10) {
		return registrationError('invalid_redirect_uri', 'Provide between 1 and 10 redirect_uris.');
	}
	for (const uri of redirectUris) {
		if (!validRedirectUri(uri)) {
			return registrationError(
				'invalid_redirect_uri',
				'Each redirect_uri must be an absolute https URL, or http on localhost / 127.0.0.1, with no credentials or fragment.'
			);
		}
	}

	const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
	if (clientName.length > 100) {
		return registrationError(
			'invalid_client_metadata',
			'client_name is limited to 100 characters.'
		);
	}

	// unauthenticated endpoint: a crude ceiling keeps a scripted caller from filling the table
	const recentClients = await db.mcpOauthClient.count({
		where: { createdAt: { gte: new Date(Date.now() - 3600000) } } // 1 hour: 60 * 60 * 1000
	});
	if (recentClients >= 100) {
		return registrationError('too_many_registrations', 'Try again later.', 429);
	}

	const client = await db.mcpOauthClient.create({
		data: { clientName: clientName || 'MCP Client', redirectUris: redirectUris as string[] }
	});
	mlog('oauth', 'register (DCR)', {
		client_name: client.clientName,
		redirect_uris: client.redirectUris,
		client_id: client.id
	});
	return json(
		{
			client_id: client.id,
			client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000), // ms to unix seconds
			client_name: client.clientName,
			redirect_uris: client.redirectUris,
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code'],
			response_types: ['code']
		},
		{ status: 201 }
	);
};
