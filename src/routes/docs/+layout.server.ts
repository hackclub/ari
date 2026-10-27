import { env } from '$env/dynamic/private';
import { requireAnyProgramOperator } from '$lib/server/authz';
import { db } from '$lib/server/db';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = requireAnyProgramOperator(locals);

	// only programs whose webhooks the viewer configures; org-wide reach is deliberately not expanded
	const settingsProgramIds = user.memberships
		.filter((membership) => membership.isPoc || membership.permissions.includes('MANAGE_SETTINGS'))
		.map((membership) => membership.programId);
	const programs = await db.program.findMany({
		where: { id: { in: settingsProgramIds }, status: { not: 'ARCHIVED' } },
		select: { id: true, name: true },
		orderBy: { name: 'asc' }
	});

	const ingestBaseUrl =
		(env.WEBHOOKS_URL?.trim() ?? '').replace(/\/$/, '') || 'https://webhooks.example.test';

	return { programs, ingestBaseUrl };
};
