import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import type { HcIdentity, HcTokens } from '$lib/server/auth';
import { signInUser } from './signIn';

const prefix = `signInTest${Date.now()}${Math.floor(Math.random() * 1000000)}`;
const boundUserId = `${prefix}Bound`;
const unboundUserId = `${prefix}Unbound`;
const boundEmail = `${boundUserId}@example.com`.toLowerCase();
const unboundEmail = `${unboundUserId}@example.com`.toLowerCase();
const boundIdentityId = `${prefix}IdentityA`;

const tokens: HcTokens = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 };
const identity = (id: string, email: string): HcIdentity => ({ id, email, slackId: null });

const boundIdentityOf = async (userId: string) =>
	(await db.account.findUnique({ where: { userId }, select: { hackClubUserId: true } }))
		?.hackClubUserId ?? null;

beforeAll(async () => {
	await db.user.createMany({
		data: [
			{ id: boundUserId, email: boundEmail, name: 'User 1', avatarColor: '#338eda' },
			{ id: unboundUserId, email: unboundEmail, name: 'User 2', avatarColor: '#338eda' }
		]
	});
	await db.account.create({
		data: {
			userId: boundUserId,
			hackClubUserId: boundIdentityId,
			accessTokenEnc: 'enc',
			refreshTokenEnc: 'enc',
			scope: '',
			expiresAt: new Date()
		}
	});
});

afterAll(async () => {
	await db.user.deleteMany({ where: { id: { in: [boundUserId, unboundUserId] } } });
});

describe('identity binding', () => {
	test('an email already bound to another hack club identity is refused, not rebound', async () => {
		const outcome = await signInUser(identity(`${prefix}IdentityB`, boundEmail), tokens, null);
		expect(outcome).toEqual({ denied: true, reason: 'identityMismatch' });
		expect(await boundIdentityOf(boundUserId)).toBe(boundIdentityId);
	});

	test('the bound identity still signs in, case-insensitively on email', async () => {
		const outcome = await signInUser(
			identity(boundIdentityId, boundEmail.toUpperCase()),
			tokens,
			null
		);
		expect(outcome.denied).toBe(false);
		if (!outcome.denied) expect(outcome.user.id).toBe(boundUserId);
		expect(await boundIdentityOf(boundUserId)).toBe(boundIdentityId);
	});

	test('a user without a bound identity gets bound on first sign-in', async () => {
		const outcome = await signInUser(identity(`${prefix}IdentityC`, unboundEmail), tokens, null);
		expect(outcome.denied).toBe(false);
		expect(await boundIdentityOf(unboundUserId)).toBe(`${prefix}IdentityC`);
		// and from then on the same rule applies
		const again = await signInUser(identity(`${prefix}IdentityD`, unboundEmail), tokens, null);
		expect(again).toEqual({ denied: true, reason: 'identityMismatch' });
	});
});
