import { json, redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/public';
import * as Sentry from '@sentry/sveltekit';
import { sessionCookie, validateSession, type SessionWithUser } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { protectedResourceMetadata, authServerMetadata, baseUrl } from '$lib/server/mcp/oauth';
import { mlog } from '$lib/server/mcp/log';
import { ndaBlocks, ndaEnforced, wantsPage } from '$lib/server/nda';
import { ndaStatus } from '$lib/server/ndaGate';

Sentry.init({
	dsn: env.PUBLIC_SENTRY_DSN,
	tracesSampleRate: 1,
	enableLogs: true,
	integrations: [Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] })]
});

// public without a session. new /api routes are private by default; /priority is gated by
// its unguessable path token, never a reviewer session
const isMcpApiPath = (path: string) => /^\/api\/mcp\/?$/.test(path);
const isAdminApiPath = (path: string) => /^\/api\/admin\/tools\/[a-z_]+$/.test(path);
const publicPaths = [
	/^\/login$/,
	/^\/auth\//,
	/^\/api\/avatar\/[^/]+\/?$/,
	/^\/api\/mcp\/?$/,
	/^\/api\/admin\/tools\/[a-z_]+$/,
	/^\/api\/openapi\.json$/,
	/^\/oauth\//,
	/^\/priority\//
];
const isPublic = (path: string) =>
	publicPaths.some((pattern) => pattern.test(path)) ||
	path.startsWith('/_app/') ||
	/\.[a-z0-9]+$/i.test(path);
// the nda page and sign-out must stay reachable while a user is blocked
const skipsNdaGate = (path: string) => path === '/' || path === '/nda' || isPublic(path);

function toSessionUser(session: SessionWithUser): App.SessionUser {
	const user = session.user;
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		namePending: user.nameSource === 'PENDING',
		avatarColor: user.avatarColor,
		slackId: user.slackId,
		orgPermissions: user.orgPermissions,
		memberships: user.memberships.map((membership) => ({
			programId: membership.programId,
			permissions: membership.permissions,
			isPoc: membership.isPoc,
			tracks: membership.tracks
		}))
	};
}

// these endpoints are token-authenticated (no cookies), so `*` is safe
const corsHeaders = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, POST, OPTIONS',
	'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
	'access-control-max-age': '86400' // 1 day: 24 * 60 * 60
};
const isMcpPath = (path: string) =>
	path.startsWith('/oauth/') || isMcpApiPath(path) || path.startsWith('/.well-known/');

// sveltekit's origin check is off (svelte.config.js), so same-origin is re-applied here for the
// cookie surface. every unsafe method must carry a matching origin, whatever the content type:
// a blob body without one still reaches json endpoints. only the bearer mcp and admin apis and
// /oauth are exempt: no ambient credential to abuse
const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
const isCsrfExempt = (path: string) =>
	isMcpApiPath(path) || isAdminApiPath(path) || path.startsWith('/oauth/');
function isCrossSiteWrite(event: { request: Request; url: URL }): boolean {
	if (!unsafeMethods.includes(event.request.method)) return false;
	return event.request.headers.get('origin') !== event.url.origin;
}

// csp is set by sveltekit (svelte.config.js); these ride on every response that leaves resolve
const securityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	return response;
};

const appHandle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// logged before routing, to tell a request that never arrived from one a handler rejected
	if (isMcpPath(path)) {
		mlog('req', `${event.request.method} ${path}`, {
			userAgent: event.request.headers.get('user-agent') ?? '',
			contentType: event.request.headers.get('content-type') ?? ''
		});
	}

	if (event.request.method === 'OPTIONS' && isMcpPath(path)) {
		return new Response(null, { status: 204, headers: corsHeaders });
	}

	if (!isCsrfExempt(path) && isCrossSiteWrite(event)) {
		mlog('csrf', `blocked cross-site ${event.request.method}`, {
			path,
			origin: event.request.headers.get('origin') ?? '(none)'
		});
		return new Response('Cross-site requests are forbidden', { status: 403 });
	}

	// served from hooks so the dotted .well-known path never depends on route-tree dotfile handling
	if (path.startsWith('/.well-known/oauth-protected-resource')) {
		mlog('oauth', 'discovery hit', { path });
		return json(protectedResourceMetadata(baseUrl(event.url.origin)), { headers: corsHeaders });
	}
	if (
		path.startsWith('/.well-known/oauth-authorization-server') ||
		path === '/.well-known/openid-configuration'
	) {
		mlog('oauth', 'discovery hit', { path });
		return json(authServerMetadata(baseUrl(event.url.origin)), { headers: corsHeaders });
	}

	const rawToken = event.cookies.get(sessionCookie);
	event.locals.user = null;
	event.locals.sessionId = null;
	let sessionUser: SessionWithUser['user'] | null = null;

	if (rawToken) {
		const session = await validateSession(rawToken);
		if (session) {
			sessionUser = session.user;
			event.locals.user = toSessionUser(session);
			event.locals.sessionId = session.id;
			// 5 minutes: 5 * 60 * 1000
			if (Date.now() - session.user.lastSeenAt.getTime() > 300000) {
				db.user
					.update({ where: { id: session.user.id }, data: { lastSeenAt: new Date() } })
					.catch(() => {});
			}
		} else {
			event.cookies.delete(sessionCookie, { path: '/' });
		}
	}

	if (!event.locals.user && path !== '/' && !isPublic(path)) {
		throw redirect(303, '/login');
	}

	if (
		sessionUser &&
		ndaEnforced() &&
		!skipsNdaGate(path) &&
		ndaBlocks(await ndaStatus(sessionUser))
	) {
		if (wantsPage(event.request.headers, event.isDataRequest)) throw redirect(303, '/nda');
		return json({ error: 'nda_required' }, { status: 403 });
	}

	const response = await resolve(event);
	if (isMcpPath(path)) {
		for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value);
	}
	return response;
};

export const handle = sequence(Sentry.sentryHandle(), securityHeaders, appHandle);
export const handleError = Sentry.handleErrorWithSentry();
