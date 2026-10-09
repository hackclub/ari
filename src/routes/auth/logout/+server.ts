import { redirect, type RequestHandler } from '@sveltejs/kit';
import { sessionCookie, invalidateSession } from '$lib/server/auth';

// post only: a get could be triggered by any cross-site link or image
export const POST: RequestHandler = async ({ cookies }) => {
	const rawToken = cookies.get(sessionCookie);
	if (rawToken) await invalidateSession(rawToken);
	cookies.delete(sessionCookie, { path: '/' });
	throw redirect(303, '/login');
};
