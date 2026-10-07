import { error, fail, redirect } from '@sveltejs/kit';
import { validateMcpToken } from '$lib/server/mcp/auth';
import { findOauthClient, issueAuthCode, baseUrl, type OauthClient } from '$lib/server/mcp/oauth';
import { mlog } from '$lib/server/mcp/log';
import type { PageServerLoad, Actions } from './$types';

interface OauthParams {
	client_id: string;
	redirect_uri: string;
	response_type: string;
	state: string;
	code_challenge: string;
	code_challenge_method: string;
	scope: string;
	resource: string;
}

function readParams(source: URLSearchParams | FormData): OauthParams {
	const read = (key: string) => String(source.get(key) ?? '');
	return {
		client_id: read('client_id'),
		redirect_uri: read('redirect_uri'),
		response_type: read('response_type'),
		state: read('state'),
		code_challenge: read('code_challenge'),
		code_challenge_method: read('code_challenge_method'),
		scope: read('scope'),
		resource: read('resource')
	};
}

// nothing is sent to redirect_uri until the client and uri are known to belong together,
// so every rejection here is a plain error page rather than an oauth error redirect
async function requireValidRequest(params: OauthParams, stage: string): Promise<OauthClient> {
	function reject(reason: string, message: string): never {
		mlog('oauth', `authorize ${stage} → 400 (${reason})`, {
			client_id: params.client_id,
			redirect_uri: params.redirect_uri
		});
		throw error(400, message);
	}
	if (params.response_type && params.response_type !== 'code') {
		reject('unsupported response_type', 'Only response_type=code is supported.');
	}
	if (!params.client_id) reject('missing client_id', 'Missing client_id.');
	const client = await findOauthClient(params.client_id);
	if (!client) reject('unknown client', 'Unknown client_id. Register the client first.');
	if (!params.redirect_uri) reject('missing redirect_uri', 'Missing redirect_uri.');
	if (!client.redirectUris.includes(params.redirect_uri)) {
		reject('unregistered redirect_uri', 'redirect_uri is not registered for this client.');
	}
	if (!params.code_challenge) {
		reject('missing code_challenge', 'PKCE is required: send a code_challenge.');
	}
	if (params.code_challenge_method !== 'S256') {
		reject('non-S256 challenge method', 'Only PKCE code_challenge_method=S256 is supported.');
	}
	return client;
}

const consentView = (client: OauthClient, redirectUri: string) => ({
	name: client.clientName,
	redirectHost: new URL(redirectUri).host
});

export const load: PageServerLoad = async ({ url }) => {
	const params = readParams(url.searchParams);
	mlog('oauth', 'authorize GET (consent page)', {
		client_id: params.client_id,
		redirect_uri: params.redirect_uri,
		method: params.code_challenge_method,
		hasChallenge: !!params.code_challenge,
		hasState: !!params.state,
		scope: params.scope
	});
	const client = await requireValidRequest(params, 'GET');
	return { params, client: consentView(client, params.redirect_uri) };
};

// no session needed: the pasted mcp token is the credential
export const actions: Actions = {
	default: async ({ request, url }) => {
		const form = await request.formData();
		const params = readParams(form);
		const token = String(form.get('token') ?? '').trim();
		mlog('oauth', 'authorize POST (consent submit)', {
			client_id: params.client_id,
			redirect_uri: params.redirect_uri,
			hasToken: !!token
		});
		const client = await requireValidRequest(params, 'POST');

		const context = token ? await validateMcpToken(token) : null;
		if (!context) {
			mlog('oauth', 'authorize POST → rejected token (re-render with error)');
			return fail(400, {
				params,
				client: consentView(client, params.redirect_uri),
				error: 'That token is invalid, revoked or expired.'
			});
		}

		const code = await issueAuthCode({
			userId: context.user.id,
			clientId: client.id,
			parentTokenId: context.tokenId,
			canWrite: context.canWrite,
			programIds: context.programIds,
			codeChallenge: params.code_challenge,
			redirectUri: params.redirect_uri
		});

		const destination = new URL(params.redirect_uri);
		destination.searchParams.set('code', code);
		if (params.state) destination.searchParams.set('state', params.state);
		destination.searchParams.set('iss', baseUrl(url.origin));
		mlog('oauth', 'authorize POST → 303 redirect with code', {
			to: destination.origin + destination.pathname,
			iss: baseUrl(url.origin)
		});
		throw redirect(303, destination.toString());
	}
};
