import { db } from '$lib/server/db';

// every token minted (directly or transitively) from the given one
export async function descendantTokenIds(rootId: string): Promise<string[]> {
	const found = new Set<string>();
	let frontier = [rootId];
	// a chain is one hop per consent screen, so 10 levels is already far beyond real use
	for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
		const children = await db.mcpToken.findMany({
			where: { parentTokenId: { in: frontier } },
			select: { id: true }
		});
		frontier = children.map((child) => child.id).filter((id) => !found.has(id) && id !== rootId);
		for (const id of frontier) found.add(id);
	}
	return [...found];
}

// a parent losing trust takes everything derived from it along
export async function revokeTokenTree(rootId: string): Promise<void> {
	const ids = [rootId, ...(await descendantTokenIds(rootId))];
	await db.mcpToken.updateMany({
		where: { id: { in: ids }, revokedAt: null },
		data: { revokedAt: new Date() }
	});
}
