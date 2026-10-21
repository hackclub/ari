import { requireUser } from '$lib/server/authz';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	requireUser(locals);
	return {};
};
