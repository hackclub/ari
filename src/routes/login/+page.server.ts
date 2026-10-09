import { redirect } from '@sveltejs/kit';
import { oauthConfigured } from '$lib/server/auth';
import { devLoginEnabled } from '$lib/server/devLogin';
import type { PageServerLoad } from './$types';

const errorMessages: Record<string, string> = {
	denied: "You don't have access to Ari. Ask your program's point of contact for an invite.",
	identity: 'This email is linked to a different Hack Club account.',
	state: 'Something went wrong with your sign-in state. Please try again.'
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) throw redirect(303, '/programs');
	const errorCode = url.searchParams.get('error');
	return {
		errorMessage: errorCode
			? (errorMessages[errorCode] ?? 'Sign-in failed. Please try again.')
			: null,
		oauthConfigured: oauthConfigured(),
		devLoginEnabled: devLoginEnabled()
	};
};
