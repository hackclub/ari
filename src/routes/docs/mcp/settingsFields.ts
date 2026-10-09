import type { DocField } from '$lib/components/docs/types';

export const settingsFields: DocField[] = [
	{
		name: 'name',
		type: 'string',
		description: 'Display name. Cannot be empty.'
	},
	{
		name: 'iconUrl',
		type: 'string',
		description:
			'`http://` or `https://` URL of the program icon. An empty string removes it. To upload a file instead, use `upload_program_image`.'
	},
	{
		name: 'cardBgUrl',
		type: 'string',
		description:
			'`http://` or `https://` URL of the card background shown on the program card. An empty string removes it.'
	},
	{
		name: 'trackingStartsAt',
		type: 'string',
		description: '`YYYY-MM-DD`. Time before this date is not counted. An empty string clears it.'
	},
	{
		name: 'evidence',
		type: 'string[]',
		description:
			'The evidence kinds the program accepts: `commits`, `elapsed`, `devlog`. This is the complete set, so a kind you leave out is turned off.'
	},
	{
		name: 'reviewersChannel',
		type: 'string',
		description:
			'The Slack channel reviewers are invited to: a channel ID like `C0123ABCDEF` or a link to the channel. An empty string unlinks it. Changing it needs Slack set up on the instance, the Ari Slack app in the channel, and the token owner as a member of it.'
	},
	{
		name: 'reviewGoal',
		type: 'integer',
		description: 'Reviews each reviewer is aiming for per week, from 1 to 10000. Default `50`.'
	},
	{
		name: 'collaborative',
		type: 'boolean',
		description:
			'Ships may list collaborators, each with their own verified time. When off, a `collaborators` array at ingest is a 422. Default `false`.'
	},
	{
		name: 'screenIdentity',
		type: 'boolean',
		description:
			'Auto-reject a ship at ingest when a maker has not verified their Hack Club identity. Default `true`.'
	},
	{
		name: 'screenHackatime',
		type: 'boolean',
		description:
			'Auto-reject a ship at ingest when a maker fails the Hackatime screen. Default `true`.'
	},
	{
		name: 'secondPass',
		type: 'boolean',
		description:
			'Hold reviewer decisions for an organizer to confirm before the program is notified. Default `false`.'
	},
	{
		name: 'secondPassApproved',
		type: 'boolean',
		description: 'With second pass on, hold approvals. Default `true`.'
	},
	{
		name: 'secondPassChanges',
		type: 'boolean',
		description: 'With second pass on, hold changes requests. Default `true`.'
	},
	{
		name: 'secondPassRejected',
		type: 'boolean',
		description: 'With second pass on, hold rejections. Default `true`.'
	},
	{
		name: 'secondPassOrganizerBypass',
		type: 'boolean',
		description:
			'With second pass on, an organizer or org admin deciding in the normal queue skips the hold. Default `true`.'
	},
	{
		name: 'reviewersCannotReviewOwnProjects',
		type: 'boolean',
		description:
			'Hide a ship from anyone who is a maker on it, matched by email or Slack ID. Default `false`.'
	},
	{
		name: 'allowDeflation',
		type: 'boolean',
		description:
			'Reviewers may deflate verified time. When off, every ship settles to its full captured time. Default `true`.'
	},
	{
		name: 'hoursJustification',
		type: 'boolean',
		description:
			'Collect the hours justification on every review. Turning it off needs `MANAGE_PROGRAMS` on the token owner. Default `true`.'
	},
	{
		name: 'reviewerReauth',
		type: 'boolean',
		description:
			'Require a fresh Hack Club Auth login before someone can open a ship to review it. Default `false`.'
	},
	{
		name: 'reviewerReauthTtlMinutes',
		type: 'integer',
		description:
			'Minutes of inactivity before the reauth login lapses, from 1 to 100000. Only used when `reviewerReauth` is on. Default `60`.'
	},
	{
		name: 'priorityReview',
		type: 'boolean',
		description:
			'Let makers ask for priority review through a public form. The form link comes back in `priorityFormPath` from `get_program_settings`. Default `false`.'
	},
	{
		name: 'priorityReviewMessage',
		type: 'string',
		description: 'Message shown at the top of the priority form, up to 2000 characters.'
	},
	{
		name: 'outboundUrl',
		type: 'string',
		description:
			'Where Ari sends review results. `http://` or `https://`, on a public address: localhost and private or internal hosts are refused. An empty string clears it.'
	},
	{
		name: 'outboundEnabled',
		type: 'boolean',
		description:
			'Send outbound webhooks. When off, deliveries wait for up to 12 hours instead of failing. Default `true`.'
	}
];
