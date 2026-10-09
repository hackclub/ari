import { privateProvider } from '$private';
import { getProgram, listActivity, listPrograms, programStats } from './programs';
import {
	findMaker,
	getSubmission,
	listSubmissions,
	searchSubmissions,
	submissionEvidence
} from './submissions';
import { listReviews, reviewerStats } from './reviews';
import { getUser, listUsers, whoami } from './members';
import { addMember, removeMember, setOrgPermissions } from './memberWrites';
import { requeueSubmission } from './requeue';
import { createProgramTool, updateProgramTool } from './programWrites';
import {
	getProgramSettings,
	rollIngestSecretTool,
	rollOutboundSecretTool,
	setReviewTools,
	updateProgramSettings,
	uploadProgramImage
} from './programSettings';
import { hasOrgPermission } from '$lib/server/authz';
import type { McpContext } from '../auth';
import type { Tool } from './shared';

export type { Tool, ToolSpec } from './shared';

const tools: Tool[] = [
	listPrograms,
	programStats,
	listSubmissions,
	getSubmission,
	listReviews,
	listUsers,
	searchSubmissions,
	whoami,
	getUser,
	getProgram,
	listActivity,
	submissionEvidence,
	findMaker,
	reviewerStats,
	getProgramSettings,
	addMember,
	removeMember,
	setOrgPermissions,
	requeueSubmission,
	createProgramTool,
	updateProgramTool,
	updateProgramSettings,
	setReviewTools,
	uploadProgramImage,
	rollIngestSecretTool,
	rollOutboundSecretTool
];
const privateTools: Tool[] = privateProvider.mcpTools();

export const mcpTools: Record<string, Tool> = Object.fromEntries(
	[...tools, ...privateTools].map((tool) => [tool.spec.name, tool])
);

// the private tools were written for org operators and cannot honour a program limit
const seesPrivateTools = (context: McpContext) =>
	hasOrgPermission(context.user, 'OPERATE_ALL_PROGRAMS') && context.programIds.length === 0;

export function toolsFor(context: McpContext): Tool[] {
	return [...tools, ...(seesPrivateTools(context) ? privateTools : [])].filter(
		(tool) => context.canWrite || !tool.write
	);
}

export function toolFor(name: string, context: McpContext): Tool | undefined {
	return [...tools, ...(seesPrivateTools(context) ? privateTools : [])].find(
		(tool) => tool.spec.name === name
	);
}

export const publicTools: Tool[] = tools;
