import type { DocRow } from '$lib/components/docs/types';

export const readTools: DocRow[] = [
	{
		name: 'whoami',
		mono: true,
		description: 'The user behind the token, the token label and whether it can write.'
	},
	{
		name: 'list_programs',
		mono: true,
		description: 'Every program with its status, accepted evidence and how many ships await review.'
	},
	{
		name: 'get_program',
		mono: true,
		description:
			'One program: status, evidence, feature flags, checklist, review fields, flag rules and whether an outbound webhook is set.'
	},
	{
		name: 'get_program_settings',
		mono: true,
		description:
			'Everything the settings page shows, in the names `update_program_settings` takes, plus the checklist, review fields, snippets, the private settings, the ingest endpoint and masked signing secrets.'
	},
	{
		name: 'program_stats',
		mono: true,
		description: 'Ship counts by status, headcount and the weekly goal for one program.'
	},
	{ name: 'list_activity', mono: true, description: "A program's activity log, newest first." },
	{
		name: 'list_submissions',
		mono: true,
		description: 'Ships in a program, newest first, filterable by status and track.'
	},
	{
		name: 'get_submission',
		mono: true,
		description: 'One ship in full: makers, verified time, flags, evidence counts and decisions.'
	},
	{
		name: 'search_submissions',
		mono: true,
		description: 'Ships whose title, repo, maker email, name or Slack ID contain a query.'
	},
	{
		name: 'submission_evidence',
		mono: true,
		description: 'The commits, devlog entries and elapsed clips captured for a ship.'
	},
	{
		name: 'find_maker',
		mono: true,
		description: 'A maker by email, Slack ID or name, with every ship they are on.'
	},
	{
		name: 'list_reviews',
		mono: true,
		description: 'Recent review decisions, filterable by program and reviewer.'
	},
	{
		name: 'reviewer_stats',
		mono: true,
		description: "One reviewer's counts by decision and program, and their recent decisions."
	},
	{
		name: 'list_users',
		mono: true,
		description: 'Users with their org permissions and memberships.'
	},
	{
		name: 'get_user',
		mono: true,
		description:
			'One reviewer or organizer: permissions, memberships, review count and recent decisions.'
	}
];

export const writeTools: DocRow[] = [
	{
		name: 'create_program',
		mono: true,
		description:
			'Create a program with its first organizers, and optionally apply settings in the same call.'
	},
	{
		name: 'update_program',
		mono: true,
		description:
			'Change name, accent colour, evidence, reviewer VMs, second pass, organizers and point of contact.'
	},
	{
		name: 'update_program_settings',
		mono: true,
		description:
			'Change any of the program settings, including images by URL, review flow and the outbound webhook URL.'
	},
	{
		name: 'set_review_tools',
		mono: true,
		description: 'Replace the checklist, custom review fields and snippets.'
	},
	{
		name: 'upload_program_image',
		mono: true,
		description: 'Upload an icon or card background and set it on the program.'
	},
	{
		name: 'roll_ingest_secret',
		mono: true,
		description:
			'Issue a new inbound signing secret, revoke the old one, and return the new one once.'
	},
	{
		name: 'roll_outbound_secret',
		mono: true,
		description: 'Issue a new outbound signing secret and return it once.'
	},
	{
		name: 'add_member',
		mono: true,
		description:
			'Add someone to a program with a set of permissions and tracks. People who have never signed in get an invite.'
	},
	{
		name: 'remove_member',
		mono: true,
		description:
			"Remove someone from one program and revoke that program's pending invites for them."
	},
	{
		name: 'set_org_permissions',
		mono: true,
		description:
			'Replace a user’s org permissions. The token owner needs `GRANT_ORG_PERMS` and cannot change their own.'
	},
	{
		name: 'requeue_submission',
		mono: true,
		description:
			'Send a decided ship back to the queue with an audit reason. The program gets `review.requeued`.'
	}
];

export const accessRows: DocRow[] = [
	{
		name: 'Programs and ships',
		description:
			'`list_programs`, `program_stats`, `list_submissions`, `get_submission`, `search_submissions`, `submission_evidence`, `find_maker`: any program you can open, ships as above.'
	},
	{
		name: 'MANAGE_SETTINGS',
		description:
			'`get_program`, `get_program_settings`, `update_program_settings`, `set_review_tools`, `upload_program_image`, `roll_ingest_secret`, `roll_outbound_secret`.'
	},
	{ name: 'VIEW_AUDIT_LOG', description: '`list_activity`, limited to your tracks.' },
	{
		name: 'VIEW_REVIEWED',
		description: '`list_reviews`, and the decision history in `get_submission`.'
	},
	{
		name: 'VIEW_REVIEWERS',
		description: '`reviewer_stats`, and the roster numbers in `list_programs` and `program_stats`.'
	},
	{ name: 'MANAGE_REVIEWERS', description: '`add_member`, `remove_member`.' },
	{ name: 'OVERRIDE_DECISIONS', description: '`requeue_submission`.' },
	{
		name: 'Org permissions',
		description:
			'`create_program` needs `CREATE_PROGRAMS` or `MANAGE_PROGRAMS`; `update_program` needs `MANAGE_PROGRAMS`; `list_users` and `get_user` need `MANAGE_PEOPLE` or `GRANT_ORG_PERMS`; `set_org_permissions` needs `GRANT_ORG_PERMS`.'
	}
];
