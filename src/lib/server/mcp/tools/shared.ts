import { isHttpError } from '@sveltejs/kit';
import type { McpContext } from '../auth';

export interface ToolSpec {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface Tool {
	spec: ToolSpec;
	write?: boolean;
	handler: (args: Record<string, unknown>, context: McpContext) => Promise<unknown>;
}

export function requireWrite(context: McpContext): void {
	if (!context.canWrite) {
		throw new ToolRefusal(
			403,
			'This token is read-only. Mint a read-write token to use write tools.'
		);
	}
}

export class ToolRefusal extends Error {
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}

// the shared app guards throw http errors: a tool reports them as a plain message
export function toolError(caught: unknown): { status: number; message: string } {
	if (isHttpError(caught)) return { status: caught.status, message: caught.body.message };
	if (caught instanceof ToolRefusal) return { status: caught.status, message: caught.message };
	return { status: 400, message: (caught as Error).message };
}

export function unwrap<Result extends { ok: boolean }>(
	result: Result
): Extract<Result, { ok: true }> {
	if (!result.ok) throw new Error((result as { error?: string }).error ?? 'The request failed.');
	return result as Extract<Result, { ok: true }>;
}

export const submissionStatuses = [
	'pending',
	'approved',
	'changes',
	'rejected',
	'reverted',
	'processing',
	'withdrawn',
	'secondpass'
] as const;

export function clampLimit(input: unknown, fallback = 25, max = 100): number {
	const value = typeof input === 'number' && Number.isFinite(input) ? Math.floor(input) : fallback;
	return Math.min(Math.max(value, 1), max);
}

export function personWhere(args: Record<string, unknown>): {
	email: string | null;
	slackId: string | null;
	name: string | null;
	conditions: Record<string, unknown>[];
} {
	const email = args.email ? String(args.email).trim().toLowerCase() : null;
	const slackId = args.slackId ? String(args.slackId).trim() : null;
	const name = args.name ? String(args.name).trim() : null;
	if (!email && !slackId && !name)
		throw new Error('Provide at least one of email, slackId, or name.');
	const conditions: Record<string, unknown>[] = [];
	if (email) conditions.push({ email });
	if (slackId) conditions.push({ slackId });
	if (name) conditions.push({ name: { contains: name, mode: 'insensitive' } });
	return { email, slackId, name, conditions };
}

export const personInput = {
	email: { type: 'string', description: 'Exact email (case-insensitive).' },
	slackId: { type: 'string', description: 'Exact Slack user id.' },
	name: { type: 'string', description: 'Case-insensitive substring of the name.' }
};
