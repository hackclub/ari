import { toolFor, toolsFor } from './tools';
import { toolError } from './tools/shared';
import type { McpContext } from './auth';
import { mlog } from './log';

export const serverInfo = { name: 'ari', version: '0.0.1' };
const defaultProtocol = '2025-06-18';
const supportedProtocols = new Set<unknown>(['2025-06-18', '2025-03-26', '2024-11-05']);

type RequestId = string | number | null;
interface JsonRpcRequest {
	jsonrpc?: string;
	id?: RequestId;
	method?: string;
	params?: { protocolVersion?: unknown; name?: string; arguments?: Record<string, unknown> };
}

const succeed = (id: RequestId, result: unknown) => ({ jsonrpc: '2.0', id, result });
const fail = (id: RequestId, code: number, message: string) => ({
	jsonrpc: '2.0',
	id,
	error: { code, message }
});

// returns null for notifications, which the caller answers with http 202
export async function dispatch(
	request: JsonRpcRequest,
	context: McpContext
): Promise<object | null> {
	const id = request.id ?? null;
	const method = request.method;
	mlog('rpc', `${method ?? '(none)'}`, { id });

	if (request.id === undefined || request.id === null) {
		if (method?.startsWith('notifications/')) {
			mlog('rpc', `notification ack: ${method}`);
			return null;
		}
	}

	switch (method) {
		case 'initialize': {
			const requested = request.params?.protocolVersion;
			const negotiated = supportedProtocols.has(requested) ? requested : defaultProtocol;
			mlog('rpc', 'initialize', { requested: requested ?? '(none)', negotiated });
			return succeed(id, {
				protocolVersion: negotiated,
				capabilities: { tools: { listChanged: false } },
				serverInfo,
				instructions:
					'Access to ari, Hack Club’s ship-review platform, as the token’s owner: every tool sees and does only what that person can in the app. Start with whoami and list_programs, then program_stats / list_submissions / get_submission. Read-write tokens can also change what their owner may change, such as program settings, review tools, members and signing secrets.'
			});
		}
		case 'ping':
			return succeed(id, {});
		case 'tools/list': {
			const specs = toolsFor(context).map((tool) => tool.spec);
			mlog('rpc', 'tools/list', { count: specs.length, canWrite: context.canWrite });
			return succeed(id, { tools: specs });
		}
		case 'tools/call': {
			const name = request.params?.name;
			// names only: values can be secrets or whole images
			mlog('rpc', `tools/call: ${name ?? '(missing name)'}`, {
				args: Object.keys(request.params?.arguments ?? {})
			});
			const tool = name ? toolFor(name, context) : undefined;
			if (!tool) {
				mlog('rpc', `tools/call unknown tool: ${name ?? '(missing name)'}`);
				return fail(id, -32602, `Unknown tool: ${name ?? '(missing name)'}`);
			}
			try {
				const result = await tool.handler(request.params?.arguments ?? {}, context);
				mlog('rpc', `tools/call ok: ${name}`);
				return succeed(id, {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
				});
			} catch (error) {
				// reported inside the result so the model sees the message and can adjust
				const { message } = toolError(error);
				mlog('rpc', `tools/call error: ${name}`, { error: message });
				return succeed(id, {
					content: [{ type: 'text', text: `Error: ${message}` }],
					isError: true
				});
			}
		}
		default:
			mlog('rpc', `method not found: ${method ?? '(none)'}`);
			return fail(id, -32601, `Method not found: ${method ?? '(none)'}`);
	}
}
