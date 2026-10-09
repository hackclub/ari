import { serverInfo } from './server';
import { publicTools } from './tools';

const errorResponse = (description: string) => ({
	description,
	content: {
		'application/json': {
			schema: {
				type: 'object',
				properties: { error: { type: 'string' } },
				required: ['error']
			}
		}
	}
});

// public: the private provider's tools cover flags and fraud review, so they stay out
export function buildOpenApi(origin: string) {
	const tools = publicTools;
	const paths = Object.fromEntries(
		tools.map((tool) => [
			`/api/admin/tools/${tool.spec.name}`,
			{
				post: {
					operationId: tool.spec.name,
					tags: [tool.write ? 'write' : 'read'],
					description: tool.spec.description,
					requestBody: {
						required: true,
						content: { 'application/json': { schema: tool.spec.inputSchema } }
					},
					responses: {
						'200': {
							description: 'The tool result.',
							content: { 'application/json': { schema: {} } }
						},
						'400': errorResponse('The tool refused the call. Nothing was saved.'),
						'401': errorResponse(
							'The bearer token is missing, revoked, expired or not an admin token.'
						),
						'403': errorResponse(
							'A write tool was called with a read-only token, or the owner lacks a permission the tool needs.'
						),
						'404': errorResponse('There is no tool by that name.')
					}
				}
			}
		])
	);
	return {
		openapi: '3.1.0',
		info: {
			title: 'Ari admin API',
			version: serverInfo.version,
			description:
				'The tools of the Ari MCP server as plain HTTP. Send the tool arguments as the JSON body; the reply is the tool result. Every call needs a token, which any user can create on their MCP page. A token acts as its owner: each tool sees and changes only what that person can in the app, and the write tools need a read-write token.'
		},
		servers: [{ url: origin }],
		security: [{ bearerAuth: [] }],
		tags: [
			{ name: 'read', description: 'Any token.' },
			{ name: 'write', description: 'Read-write tokens only.' }
		],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: 'http',
					scheme: 'bearer',
					description: 'An ari_mcp_ token from your MCP page.'
				}
			}
		},
		paths
	};
}
