import { db } from '$lib/server/db';
import { encrypt } from '$lib/server/crypto';
import { accentColors, allOrgPermissions } from '$lib/data';
import { oauthScopes, type HcIdentity, type HcTokens } from '$lib/server/auth';
import { systemUserId } from '$lib/server/systemUser';
import { safeReturnPath as sharedSafeReturnPath } from '$lib/returnPath';
import type { User } from '$db';

// login and callback both apply it: neither side trusts a raw value
export const safeReturnPath = (raw: string | null | undefined): string =>
	sharedSafeReturnPath(raw, '/programs');

function colorFor(email: string): string {
	let hash = 0;
	for (let index = 0; index < email.length; index++) {
		hash = (hash * 31 + email.charCodeAt(index)) >>> 0; // 31: the usual string-hash multiplier
	}
	return accentColors[hash % accentColors.length];
}

export type SignInOutcome =
	| { denied: true; reason: 'noInvite' | 'identityMismatch' }
	| { denied: false; user: User; syncChannels: boolean; joinedProgramIds: string[] };

// first human wins the bootstrap, everyone after is invite-gated by email.
// slackName is the slack display name: the provider's legal name is never used (it can deadname)
export async function signInUser(
	identity: HcIdentity,
	tokens: HcTokens,
	slackName: string | null
): Promise<SignInOutcome> {
	const displayName = slackName ?? identity.email;
	const nameSource = slackName ? ('SLACK' as const) : ('PENDING' as const);
	const accountData = {
		hackClubUserId: identity.id ?? null,
		accessTokenEnc: encrypt(tokens.access_token),
		refreshTokenEnc: encrypt(tokens.refresh_token ?? ''),
		scope: tokens.scope ?? oauthScopes,
		expiresAt: new Date(Date.now() + (tokens.expires_in ?? 0) * 1000) // seconds to ms
	};

	return db.$transaction(async (transaction) => {
		let syncChannels = false;
		let joinedProgramIds: string[] = [];

		// the hack club user id is the stable identity: the primary email can change
		const identityAccount = identity.id
			? await transaction.account.findUnique({
					where: { hackClubUserId: identity.id },
					include: { user: true }
				})
			: null;
		// case-insensitive: an exact match could miss the account and mint a duplicate user
		const emailUser = await transaction.user.findFirst({
			where: { email: { equals: identity.email, mode: 'insensitive' } }
		});
		let user = identityAccount?.user ?? emailUser;

		// an email reached by a different hack club identity than the one already bound to
		// that user is refused, never rebound: the binding is what makes the identity stable
		if (!identityAccount && emailUser && identity.id) {
			const boundAccount = await transaction.account.findUnique({
				where: { userId: emailUser.id },
				select: { hackClubUserId: true }
			});
			if (boundAccount?.hackClubUserId && boundAccount.hackClubUserId !== identity.id) {
				return { denied: true, reason: 'identityMismatch' } as const;
			}
		}

		if (!user) {
			const newUser = {
				email: identity.email,
				name: displayName,
				nameSource,
				slackId: identity.slackId,
				avatarColor: colorFor(identity.email)
			};
			// the seeded system user must not count, or a fresh deploy could never bootstrap
			const isFirst =
				(await transaction.user.count({ where: { id: { not: systemUserId } } })) === 0;
			if (isFirst) {
				user = await transaction.user.create({
					data: { ...newUser, orgPermissions: allOrgPermissions }
				});
			} else {
				// accept every pending invite, not just the oldest: invites are only consumed here
				const invites = await transaction.invite.findMany({
					where: { email: { equals: identity.email, mode: 'insensitive' }, acceptedAt: null },
					orderBy: { createdAt: 'asc' }
				});
				if (invites.length === 0) return { denied: true, reason: 'noInvite' } as const;
				user = await transaction.user.create({
					data: {
						...newUser,
						orgPermissions: allOrgPermissions.filter((permission) =>
							invites.some((invite) => invite.orgPermissions.includes(permission))
						)
					}
				});
				// one membership per program: the newest invite wins
				const inviteByProgram = new Map<string, (typeof invites)[number]>();
				for (const invite of invites) {
					if (invite.programId) inviteByProgram.set(invite.programId, invite);
				}
				for (const [programId, invite] of inviteByProgram) {
					await transaction.membership.create({
						data: {
							userId: user.id,
							programId,
							permissions: invite.permissions,
							tracks: invite.tracks
						}
					});
				}
				if (inviteByProgram.size > 0) {
					syncChannels = true;
					joinedProgramIds = [...inviteByProgram.keys()];
				}
				await transaction.invite.updateMany({
					where: { id: { in: invites.map((invite) => invite.id) } },
					data: { acceptedAt: new Date() }
				});
			}
		} else {
			// a slack id resolving for the first time is when channel sync becomes possible
			if (!user.slackId && identity.slackId) syncChannels = true;
			user = await transaction.user.update({
				where: { id: user.id },
				data: {
					// keep the email current unless another local user already owns it
					...(identityAccount && (!emailUser || emailUser.id === user.id)
						? { email: identity.email }
						: {}),
					...(slackName ? { name: slackName, nameSource: 'SLACK' as const } : {}),
					slackId: identity.slackId ?? user.slackId,
					lastSeenAt: new Date()
				}
			});
		}

		await transaction.account.upsert({
			where: { userId: user.id },
			create: { userId: user.id, ...accountData },
			update: accountData
		});

		return { denied: false, user, syncChannels, joinedProgramIds } as const;
	});
}
