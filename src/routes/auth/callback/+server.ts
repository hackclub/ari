import { redirect, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { db } from '$lib/server/db';
import { canReviewProgram } from '$lib/server/authz';
import {
	exchangeCode,
	fetchIdentity,
	createSession,
	sessionCookie,
	stateCookie
} from '$lib/server/auth';
import { slackProfile } from '$lib/server/slack';
import { queueOrgChannelSync, queueReviewersChannelSync } from '$lib/server/slackChannels';
import { setMakerIdentityCookie, formTokenPattern } from '$lib/server/priorityForm';
import { grantReauth } from '$lib/server/reauth';
import { constantTimeEqual } from '$lib/server/constantTimeEqual';
import { safeReturnPath, signInUser } from '$lib/server/signIn';

// never the provider's legal name: it can deadname
const slackDisplayName = async (slackId: string | null) =>
	slackId ? ((await slackProfile(slackId))?.displayName ?? null) : null;

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const saved = cookies.get(stateCookie);
	cookies.delete(stateCookie, { path: '/' });

	if (!code || !state || !saved) throw redirect(303, '/login?error=state');

	// t: state token, k: 1 reauth / 2 priority form, p: program, r: return path, f: form token
	let parsed: { t: string; k?: number; p?: string; r?: string; f?: string };
	try {
		parsed = JSON.parse(saved);
	} catch {
		parsed = { t: saved };
	}
	if (!constantTimeEqual(state, String(parsed.t ?? ''))) {
		throw redirect(303, '/login?error=state');
	}

	const tokens = await exchangeCode(code);
	const identity = await fetchIdentity(tokens.access_token);

	// a maker verifying for the public priority form: no user or session is minted
	if (parsed.k === 2) {
		const formToken =
			typeof parsed.f === 'string' && formTokenPattern.test(parsed.f) ? parsed.f : '';
		if (!formToken) throw redirect(303, '/login?error=state');
		const program = await db.program.findUnique({
			where: { priorityReviewToken: formToken },
			select: { priorityReview: true, status: true }
		});
		if (program?.priorityReview && program.status === 'ACTIVE') {
			setMakerIdentityCookie(cookies, {
				email: identity.email,
				slackId: identity.slackId,
				name: await slackDisplayName(identity.slackId)
			});
		}
		throw redirect(303, `/priority/${formToken}`);
	}

	// step-up reauth: no new session. fail closed if a different identity came back
	if (parsed.k === 1) {
		const sessionUser = locals.user;
		if (!sessionUser || identity.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
			throw redirect(303, '/login?error=reauth');
		}
		// a stale return could name a program they have since lost access to
		if (parsed.p && canReviewProgram(sessionUser, parsed.p)) {
			await grantReauth(sessionUser.id, parsed.p);
		}
		throw redirect(303, safeReturnPath(parsed.r));
	}

	const outcome = await signInUser(identity, tokens, await slackDisplayName(identity.slackId));
	if (outcome.denied) {
		throw redirect(
			303,
			outcome.reason === 'identityMismatch' ? '/login?error=identity' : '/login?error=denied'
		);
	}

	if (outcome.syncChannels) queueOrgChannelSync(outcome.user.id);
	for (const programId of outcome.joinedProgramIds) {
		queueReviewersChannelSync(programId, outcome.user.id, 'add');
	}

	const { rawToken } = await createSession(outcome.user.id);
	cookies.set(sessionCookie, rawToken, {
		path: '/',
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		maxAge: 2592000 // 30 days in seconds: 30 * 24 * 60 * 60
	});

	throw redirect(303, '/programs');
};
