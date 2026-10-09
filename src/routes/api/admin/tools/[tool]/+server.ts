import { callToolOverRest } from '$lib/server/mcp/rest';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ params, request }) => callToolOverRest(params.tool, request);
