import { fail } from '@sveltejs/kit';
import { requireUser } from '$lib/server/authz';
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
	const user = requireUser(locals);
	const [tokens, programs] = await Promise.all([
		tokenRows({ userId: user.id }),
		pickablePrograms(user)
	]);
	return { endpoint: `${baseUrl(url.origin)}/api/mcp`, tokens, programs };
};

const answered = <Data extends object>(result: TokenResult<Data>) =>
	result.ok ? result : fail(result.status, { error: result.error });

// every action is limited to the signed-in person's own tokens
export const actions: Actions = {
	mint: async ({ locals, request }) =>
		answered(await mintToken(requireUser(locals), await request.formData())),

	revoke: async ({ locals, request }) => {
		const user = requireUser(locals);
		const id = String((await request.formData()).get('id') ?? '');
		return answered(await revokeToken(id, user.id));
	},

	delete: async ({ locals, request }) => {
		const user = requireUser(locals);
		const id = String((await request.formData()).get('id') ?? '');
		return answered(await deleteToken(id, user.id));
	}
};
