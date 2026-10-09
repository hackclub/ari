const toggle = (description: string) => ({ type: 'boolean', description });
const text = (description: string) => ({ type: 'string', description });

export const settingsProperties = {
	name: text('Display name.'),
	iconUrl: text('http(s) URL of the program icon. Empty string clears it.'),
	cardBgUrl: text('http(s) URL of the program card background. Empty string clears it.'),
	trackingStartsAt: text(
		'YYYY-MM-DD: ships before this date are not tracked. Empty string clears it.'
	),
	evidence: {
		type: 'array',
		items: { type: 'string', enum: ['commits', 'elapsed', 'devlog'] },
		description: 'Accepted evidence kinds. The complete set: kinds left out are turned off.'
	},
	reviewersChannel: text(
		'Slack channel id (C0123ABCDEF) or channel link. Empty string unlinks it.'
	),
	reviewGoal: { type: 'integer', description: 'Per-reviewer weekly review goal, 1-10000.' },
	collaborative: toggle('Ships may list collaborators.'),
	screenIdentity: toggle('Auto-reject ships from makers without a verified Hack Club identity.'),
	screenHackatime: toggle('Auto-reject ships from makers that fail the Hackatime screen.'),
	secondPass: toggle('Park reviewer decisions for an organizer to confirm.'),
	secondPassApproved: toggle('Second pass holds approvals.'),
	secondPassChanges: toggle('Second pass holds changes requests.'),
	secondPassRejected: toggle('Second pass holds rejections.'),
	secondPassOrganizerBypass: toggle('Organizer decisions skip the second-pass hold.'),
	reviewersCannotReviewOwnProjects: toggle('Hide a reviewer’s own ships from them.'),
	allowDeflation: toggle('Reviewers may deflate verified time.'),
	hoursJustification: toggle(
		'Collect the hours justification. Turning it off needs MANAGE_PROGRAMS on the token owner.'
	),
	reviewerReauth: toggle('Require a fresh Hack Club Auth login before reviewing.'),
	reviewerReauthTtlMinutes: {
		type: 'integer',
		description: 'Inactivity window in minutes before reauth lapses, 1-100000.'
	},
	priorityReview: toggle('Let makers request priority review through a public form.'),
	priorityReviewMessage: text('Message shown at the top of the priority form.'),
	outboundUrl: text(
		'http(s) URL the program’s review results are POSTed to. Empty string clears it.'
	),
	outboundEnabled: toggle('Deliver outbound webhooks.')
};

export const privateSettingsProperty = {
	type: 'object',
	additionalProperties: { type: 'string' },
	description:
		'Settings owned by the private provider (flag rules, fraud review, screening), as the string entries its settings cards post. Fields left out are untouched. Read the current ones from get_program_settings.privateSettings.'
};
