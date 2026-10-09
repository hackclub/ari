import type { Prisma } from '$db';
import { db } from '$lib/server/db';
import { canAccessProgram, hasOrgPermission } from '$lib/server/authz';
import { ago } from '$lib/server/serialize';
import { generateMcpToken } from './auth';
import { descendantTokenIds, revokeTokenTree } from './tokenLineage';

export type TokenResult<Data = object> =
	| ({ ok: true } & Data)
	| { ok: false; status: number; error: string };

function tokenState(token: { revokedAt: Date | null; expiresAt: Date | null }) {
	if (token.revokedAt) return 'revoked' as const;
	if (token.expiresAt && token.expiresAt.getTime() < Date.now()) return 'expired' as const;
	return 'active' as const;
}

export async function pickablePrograms(user: App.SessionUser) {
	const programs = await db.program.findMany({
		where: hasOrgPermission(user, 'VIEW_ALL_PROGRAMS')
			? { status: { not: 'ARCHIVED' } }
			: { id: { in: user.memberships.map((membership) => membership.programId) } },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});
	return programs.filter((program) => canAccessProgram(user, program.id));
}

export async function tokenRows(where: Prisma.McpTokenWhereInput) {
	const rows = await db.mcpToken.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		include: {
			user: { select: { name: true, email: true, avatarColor: true } },
			parentToken: { select: { label: true, last4: true } }
		}
	});
	const programIds = [...new Set(rows.flatMap((token) => token.programIds))];
	const names = new Map(
		(
			await db.program.findMany({
				where: { id: { in: programIds } },
				select: { id: true, name: true }
			})
		).map((program) => [program.id, program.name])
	);
	return rows.map((token) => ({
		id: token.id,
		label: token.label,
		last4: token.last4,
		owner: token.user.name,
		ownerEmail: token.user.email,
		ownerColor: token.user.avatarColor,
		canWrite: token.canWrite,
		programs: token.programIds.map((id) => names.get(id) ?? id),
		state: tokenState(token),
		created: ago(token.createdAt),
		lastUsed: token.lastUsedAt ? ago(token.lastUsedAt) : null,
		// yyyy-mm-dd: 10 characters
		expires: token.expiresAt ? token.expiresAt.toISOString().slice(0, 10) : null,
		parent: token.parentToken ? `${token.parentToken.label} (…${token.parentToken.last4})` : null
	}));
}

export async function mintToken(
	actor: App.SessionUser,
	form: FormData
): Promise<TokenResult<{ token: string; label: string }>> {
	const label =
		String(form.get('label') ?? '').trim() ||
		`${actor.name} (${new Date().toISOString().slice(0, 10)})`; // yyyy-mm-dd: 10 characters
	const daysRaw = String(form.get('days') ?? '').trim();
	const days = daysRaw ? Number(daysRaw) : null;
	if (days !== null && (!Number.isFinite(days) || days <= 0)) {
		return { ok: false, status: 400, error: 'Expiry must be a positive number of days.' };
	}
	const canWrite = form.get('canWrite') === 'on';

	const requested = [...new Set(form.getAll('programIds').map(String).filter(Boolean))];
	const pickable = new Set((await pickablePrograms(actor)).map((program) => program.id));
	if (requested.some((id) => !pickable.has(id))) {
		return {
			ok: false,
			status: 403,
			error: 'You can only limit a token to programs you can open.'
		};
	}

	const { raw, hash, last4 } = generateMcpToken();
	// ms in a day: 24 * 60 * 60 * 1000
	const expiresAt = days !== null ? new Date(Date.now() + days * 86400000) : null;
	await db.mcpToken.create({
		data: {
			tokenHash: hash,
			userId: actor.id,
			label,
			last4,
			expiresAt,
			canWrite,
			programIds: requested
		}
	});
	return { ok: true, token: raw, label };
}

// ownerId null: an org admin acting on anyone's token
const ownedWhere = (id: string, ownerId: string | null) => ({
	id,
	...(ownerId ? { userId: ownerId } : {})
});

// the row is kept for audit and fails closed on the next request. tokens minted through
// the oauth flow with this one go with it
export async function revokeToken(id: string, ownerId: string | null): Promise<TokenResult> {
	if (!id) return { ok: false, status: 400, error: 'No token id.' };
	const token = await db.mcpToken.findFirst({
		where: ownedWhere(id, ownerId),
		select: { id: true }
	});
	if (!token) return { ok: false, status: 404, error: 'No such token.' };
	await revokeTokenTree(id);
	return { ok: true };
}

export async function deleteToken(id: string, ownerId: string | null): Promise<TokenResult> {
	if (!id) return { ok: false, status: 400, error: 'No token id.' };
	const token = await db.mcpToken.findFirst({
		where: ownedWhere(id, ownerId),
		select: { id: true }
	});
	if (!token) return { ok: true };
	// deleting the parent nulls the children's link, so they are revoked first
	const children = await descendantTokenIds(id);
	await db.mcpToken.updateMany({
		where: { id: { in: children }, revokedAt: null },
		data: { revokedAt: new Date() }
	});
	await db.mcpToken.deleteMany({ where: { id } });
	return { ok: true };
}
