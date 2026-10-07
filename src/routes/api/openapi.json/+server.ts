import { json } from '@sveltejs/kit';
import { baseUrl } from '$lib/server/mcp/oauth';
import { buildOpenApi } from '$lib/server/mcp/openapi';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	json(buildOpenApi(baseUrl(url.origin)), {
		headers: { 'access-control-allow-origin': '*' }
	});
