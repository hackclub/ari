import { json } from '@sveltejs/kit';
import { bearerToken, validateMcpToken, type McpContext } from './auth';
import { mlog, tail4 } from './log';
import { toolFor } from './tools';
import { toolError } from './tools/shared';

const refuse = (status: number, error: string) => json({ error }, { status });

export async function restContext(request: Request): Promise<McpContext | Response> {
	const rawToken = bearerToken(request);
	if (!rawToken) return refuse(401, 'missing bearer token');
	const context = await validateMcpToken(rawToken);
	if (!context) {
		mlog('rest', '→ 401 (token rejected)', { bearer: tail4(rawToken) });
		return refuse(401, 'invalid or non-admin token');
	}
	return context;
}

async function argumentsOf(request: Request): Promise<Record<string, unknown> | null> {
	const body = (await request.text()).trim();
	if (!body) return {};
	try {
		const parsed: unknown = JSON.parse(body);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export async function callToolOverRest(name: string, request: Request): Promise<Response> {
	const context = await restContext(request);
	if (context instanceof Response) return context;
	const tool = toolFor(name, context);
	if (!tool) return refuse(404, `Unknown tool: ${name}`);
	if (tool.write && !context.canWrite) {
		return refuse(403, 'This token is read-only. Mint a read-write token to use write tools.');
	}
	const args = await argumentsOf(request);
	if (!args) return refuse(400, 'The body must be a JSON object of tool arguments.');

	// names only: values can be secrets or whole images
	mlog('rest', `call: ${name}`, { args: Object.keys(args), token: context.tokenLabel });
	try {
		return json(await tool.handler(args, context));
	} catch (error) {
		const { status, message } = toolError(error);
		mlog('rest', `call error: ${name}`, { error: message });
		return refuse(status, message);
	}
}
