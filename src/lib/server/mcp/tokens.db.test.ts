import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import { db } from '$lib/server/db';
import { validateMcpToken } from './auth';
import { deleteToken, mintToken, pickablePrograms, revokeToken, tokenRows } from './tokens';
import { mcpFixture } from './toolsTestFixture';

const fixture = mcpFixture('mcpTokensTest');
const { prefix, adminId, outsiderId, programId } = fixture;
const otherProgramId = `${prefix}Other`;

const consoleLog = spyOn(console, 'log').mockImplementation(() => {});

const formOf = (entries: Record<string, string | string[]>) => {
	const form = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		for (const entry of Array.isArray(value) ? value : [value]) form.append(key, entry);
	}
	return form;
};

const sessionUser = async (id: string) =>
	(await validateMcpToken(await fixture.mintToken(id, false)))!.user;

beforeAll(async () => {
	await fixture.create();
	await db.program.create({
		data: { id: otherProgramId, name: `${prefix} other`, color: '#338eda', accepts: ['commits'] }
	});
});

afterAll(async () => {
	await db.program.deleteMany({ where: { id: otherProgramId } });
	await fixture.remove();
	consoleLog.mockRestore();
});

describe('minting', () => {
	test('anyone can mint, and a narrowed token keeps its programs', async () => {
		const admin = await sessionUser(adminId);
		const minted = await mintToken(
			admin,
			formOf({ label: 'narrow', canWrite: 'on', programIds: [programId] })
		);
		if (!minted.ok) throw new Error(minted.error);
		const context = (await validateMcpToken(minted.token))!;
		expect(context.programIds).toEqual([programId]);
		expect(context.canWrite).toBe(true);

		const outsider = await sessionUser(outsiderId);
		const plain = await mintToken(outsider, formOf({ label: 'plain' }));
		expect(plain.ok).toBe(true);
	});

	test('a token cannot be narrowed to a program its owner cannot open', async () => {
		const outsider = await sessionUser(outsiderId);
		expect(await pickablePrograms(outsider)).toEqual([]);
		expect(await mintToken(outsider, formOf({ programIds: [programId] }))).toEqual({
			ok: false,
			status: 403,
			error: 'You can only limit a token to programs you can open.'
		});
	});

	test('an org viewer can pick any active program', async () => {
		const admin = await sessionUser(adminId);
		const picked = (await pickablePrograms(admin)).map((program) => program.id);
		expect(picked).toEqual(expect.arrayContaining([programId, otherProgramId]));
	});
});

describe('managing tokens', () => {
	test('people only see, revoke and delete their own', async () => {
		const outsider = await sessionUser(outsiderId);
		const minted = await mintToken(outsider, formOf({ label: 'mine' }));
		if (!minted.ok) throw new Error(minted.error);
		const row = (await tokenRows({ userId: outsiderId })).find((token) => token.label === 'mine')!;
		expect(row.programs).toEqual([]);

		expect(await revokeToken(row.id, adminId)).toEqual({
			ok: false,
			status: 404,
			error: 'No such token.'
		});
		await deleteToken(row.id, adminId);
		expect(await validateMcpToken(minted.token)).not.toBeNull();

		expect(await revokeToken(row.id, outsiderId)).toEqual({ ok: true });
		expect(await validateMcpToken(minted.token)).toBeNull();
		await deleteToken(row.id, outsiderId);
		expect(await db.mcpToken.count({ where: { id: row.id } })).toBe(0);
	});

	test('an mcp manager acts on anyone’s token', async () => {
		const outsider = await sessionUser(outsiderId);
		const minted = await mintToken(outsider, formOf({ label: 'theirs' }));
		if (!minted.ok) throw new Error(minted.error);
		const row = (await tokenRows({})).find((token) => token.label === 'theirs')!;
		expect(row.ownerEmail).toBe(outsider.email);
		expect(await revokeToken(row.id, null)).toEqual({ ok: true });
		expect(await validateMcpToken(minted.token)).toBeNull();
	});
});
