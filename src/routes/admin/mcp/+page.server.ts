import { fail } from '@sveltejs/kit';
import { requireOrgPermission } from '$lib/server/authz';
import { baseUrl } from '$lib/server/mcp/oauth';
import {
	deleteToken,
	mintToken,
	pickablePrograms,
	revokeToken,
	tokenRows,
	type TokenResult
} from '$lib/server/mcp/tokens';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireOrgPermission(locals, 'MANAGE_MCP');
	const [tokens, programs] = await Promise.all([tokenRows({}), pickablePrograms(user)]);
	return { endpoint: `${baseUrl(url.origin)}/api/mcp`, tokens, programs };
};

const answered = <Data extends object>(result: TokenResult<Data>) =>
	result.ok ? result : fail(result.status, { error: result.error });

// an mcp manager oversees everyone's tokens, but still mints only their own
export const actions: Actions = {
	mint: async ({ locals, request }) =>
		answered(await mintToken(requireOrgPermission(locals, 'MANAGE_MCP'), await request.formData())),

	revoke: async ({ locals, request }) => {
		requireOrgPermission(locals, 'MANAGE_MCP');
		const id = String((await request.formData()).get('id') ?? '');
		return answered(await revokeToken(id, null));
	},

	delete: async ({ locals, request }) => {
		requireOrgPermission(locals, 'MANAGE_MCP');
		const id = String((await request.formData()).get('id') ?? '');
		return answered(await deleteToken(id, null));
	}
};
