import { baseUrl } from '$lib/server/mcp/oauth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	endpoint: `${baseUrl(url.origin)}/api/mcp`,
	openApiUrl: `${baseUrl(url.origin)}/api/openapi.json`
});
