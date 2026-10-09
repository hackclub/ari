import type { DocField } from '$lib/components/docs/types';

export const inboundFields: DocField[] = [
	{
		name: 'external_id',
		type: 'string',
		requirement: 'required',
		description:
			'Your own ID for this project. Ari uses it to recognize the same project later, like when you resend it or withdraw it.'
	},
	{
		name: 'maker.email',
		type: 'string',
		requirement: 'required',
		description:
			"The maker's Hack Club email. Ari uses it to find their account and pull their Hackatime time when no Hackatime ID is given."
	},
	{
		name: 'maker.name',
		type: 'string',
		requirement: 'required',
		description: "The maker's display name, shown in the queue."
	},
	{
		name: 'maker.slack_id',
		type: 'string',
		requirement: 'required',
		description: "The maker's Slack user ID. Ari uses it to show their avatar."
	},
	{
		name: 'maker.hackatime_id',
		type: 'string',
		description:
			"The maker's Hackatime ID. Include it to skip the email and Slack lookup when pulling their verified time."
	},
	{
		name: 'maker.program_seconds',
		type: 'integer',
		description:
			'Extra time your program vouches for, in whole seconds, on top of the evidence Ari verifies. An integer from 0 to 3600000 (1000h per person). It counts toward the verified total as its own "program-added" source and is reviewer-deflatable (a reviewer can lower the number, never raise it). Solo ships only. On collaborative ships put it on each `collaborators[].program_seconds` instead. This is the exact form of `maker.program_hours`: when more than one is sent, `program_seconds` wins over `program_minutes`, which wins over `program_hours`. A non-integer or out-of-range value is rejected with 422 the same way `program_minutes` is. New integrations should send seconds.'
	},
	{
		name: 'maker.program_hours',
		type: 'number',
		description:
			'Extra hours your program vouches for, on top of the evidence Ari verifies. They count toward the verified total as their own "program-added" source and are reviewer-deflatable (a reviewer can lower the number, never raise it). Solo ships only. On collaborative ships put it on each `collaborators[].program_hours` instead. You can also send `program_minutes`; capped at 1000h per person. Both keep working exactly as before and are stored as minutes × 60 seconds; `program_seconds` takes precedence when it is also sent. (The legacy `hours` field stays ignored.)'
	},
	{
		name: 'collaborators',
		type: 'object[]',
		description:
			'Only for programs with collaboration turned on. The list of everyone who worked on the ship, up to 10. When you send it, these people become the ship and each gets their own verified time, while maker stays the submitter. Leave it out or send an empty array for a solo ship. Sending it when collaboration is off returns 422 `collaborators_not_enabled`.'
	},
	{
		name: 'collaborators[].email',
		type: 'string',
		requirement: 'required',
		description:
			"This person's Hack Club email. It links them to their account and scopes their Hackatime time. Required for everyone, and you cannot list the same email twice."
	},
	{
		name: 'collaborators[].name',
		type: 'string',
		description: "This person's display name."
	},
	{
		name: 'collaborators[].slack_id',
		type: 'string',
		description: "This person's Slack user ID, used for their avatar."
	},
	{
		name: 'collaborators[].hackatime_id',
		type: 'string',
		description:
			"This person's Hackatime ID. Include it to skip the email and Slack lookup for them."
	},
	{
		name: 'collaborators[].program_seconds',
		type: 'integer',
		description:
			'Extra time your program vouches for this person, in whole seconds, on top of evidence. An integer from 0 to 3600000 (1000h). Same rules as `maker.program_seconds`: it counts toward the verified total, is reviewer-deflatable, and wins over `program_minutes`, which wins over `program_hours`. A non-integer or out-of-range value is rejected with 422 the same way `program_minutes` is. This is where program-added time goes on collaborative ships.'
	},
	{
		name: 'collaborators[].program_hours',
		type: 'number',
		description:
			'Extra hours your program vouches for this person, on top of evidence. Same rules as `maker.program_hours` (counts toward the verified total, reviewer-deflatable, `program_minutes` also accepted, capped at 1000h, stored as minutes × 60 seconds, `program_seconds` takes precedence). This is where program-added time goes on collaborative ships.'
	},
	{
		name: 'collaborators[].hackatime_projects',
		type: 'string[]',
		description:
			"This person's own Hackatime project keys. They merge into the ship's `hackatime_projects` list (deduped), so everyone's projects get their time tracked even when each person named theirs differently. The review screen shows which project each person's time came from. Entries follow the same rules as the ship-level list, including the `<<LAST_PROJECT>>` placeholder handling, and they count toward the evidence floor."
	},
	{
		name: 'journals',
		type: 'object[]',
		description:
			'Work log entries for the ship, up to 200. Each one needs a date, a length, and what got done. They count toward the verified total as their own journal source.'
	},
	{
		name: 'journals[].at',
		type: 'string',
		requirement: 'required',
		description:
			'When the entry happened, as an ISO 8601 date or date-time. The key `date` works as an alias. An unreadable value returns 422 (field `journals.at`).'
	},
	{
		name: 'journals[].seconds',
		type: 'integer',
		requirement: 'oneOf',
		description:
			'How long the entry covers, in whole seconds. An integer from 0 to 86400. When more than one length is sent, `seconds` wins over `minutes`, which wins over `hours`. A non-integer or out-of-range value is rejected with 422 the same way `journals[].minutes` is. New integrations should send seconds.'
	},
	{
		name: 'journals[].minutes',
		type: 'number',
		requirement: 'oneOf',
		description:
			'How long the entry covers, 0 to 1440. You can send `journals[].hours` instead and Ari multiplies by 60. Both keep working exactly as before and are stored as minutes × 60 seconds; `journals[].seconds` takes precedence when it is also sent. Leaving every length out returns 422 (field `journals.minutes`).'
	},
	{
		name: 'journals[].text',
		type: 'string',
		requirement: 'required',
		description:
			'What got done, up to 10,000 characters. A blank entry returns 422 (field `journals.text`).'
	},
	{
		name: 'journals[].markdown',
		type: 'string',
		description:
			'A richer markdown version of the entry, up to 50,000 characters. Falls back to text when left out.'
	},
	{
		name: 'journals[].email',
		type: 'string',
		description:
			'Only needed when you send collaborators. Each journal entry has to name its author with an email that matches one of the collaborators, so the time counts toward the right person. Leave it off for solo ships. Missing it returns 422 (field `journals.email`).'
	},
	{
		name: 'title',
		type: 'string',
		requirement: 'required',
		description: "The project's title."
	},
	{
		name: 'description',
		type: 'string',
		requirement: 'required',
		description: 'A short description of the project. Reviewers see it under the title.'
	},
	{
		name: 'repo_url',
		type: 'string',
		requirement: 'required',
		description:
			'Link to the public GitHub repo. Ari pulls commit history from here. Private repos return no commits.'
	},
	{
		name: 'track',
		type: 'string',
		description:
			"Either 'software' (the default) or 'hardware'. It picks the review queue and whether `demo_url` is required. Hardware ships can skip `demo_url`."
	},
	{
		name: 'shipped_at',
		type: 'string',
		description:
			'For migrations only. An ISO 8601 date to backdate the ship instead of using now. You can also pass it as a `?shipped_at=` query param, but the signed body wins. Dates more than a day in the future or before 2000 are rejected (422, field `shipped_at`).'
	},
	{
		name: 'demo_url',
		type: 'string',
		description:
			'A link to a live demo or video. Must be http or https. Required for software ships (422 if missing) and optional for hardware. If you send it, it has to be a valid URL.'
	},
	{
		name: 'thumbnail_url',
		type: 'string',
		requirement: 'required',
		description:
			'An image for the project, shown in the queue and on the review screen. Must be http or https.'
	},
	{
		name: 'hours',
		type: 'number',
		description:
			'Ignored (a leftover field). Ari works out evidence time (Hackatime, journals, lapse) itself. To add time your program vouches for, use `program_seconds` (or the older `program_hours`) instead.'
	},
	{
		name: 'hackatime_projects',
		type: 'string[]',
		description:
			'The exact Hackatime project keys for this ship, up to 50 (more returns 422, field `hackatime_projects`). They scope the verified time and timelapses Ari pulls. A ship needs at least one of `hackatime_projects`, `journals`, or program-added time (`program_seconds`/`program_minutes`/`program_hours`). Programs that track hours themselves can skip Hackatime entirely and send program-added time alone. 422 only when all three are missing (field `hackatime_projects_or_journals_or_program_hours`). The placeholder `<<LAST_PROJECT>>` is accepted but never stored, and when it is the only project on the ship, Ari automatically requests changes so the maker can pick a real one.'
	},
	{
		name: 'evidence',
		type: 'string[]',
		description:
			'Which kinds of evidence to use. Any of: `commits`, `elapsed`, `devlog`. Unknown values are dropped, and only the kinds your program accepts count.'
	},
	{
		name: 'meta',
		type: 'object',
		description:
			'Any extra context you want reviewers to see, as key-value pairs. For example, a link back to the project on your site or an internal note. Up to 24 keys, flat only (no nested objects), keys up to 80 characters and values up to 2,000. Values are strings, and links become clickable. One key is special: `git`, an array of extra repository URLs for projects spread across several repos. They turn the Repository link on the review screen into a dropdown listing every repo. Only `repo_url` is fetched and analyzed (commits, hours, files); the extras are shown to reviewers exactly as sent, so keep the main repo in `repo_url`.'
	},
	{
		name: 'is_update',
		type: 'boolean',
		description:
			'Marks the ship as an update to an earlier one. Reviewers see a blue "Maker update" marker. Sending a non-empty `update_message` turns this on automatically.'
	},
	{
		name: 'update_message',
		type: 'string',
		description:
			'A short note (up to 2000 characters) on what the maker changed since their last ship. Shown next to the blue update marker.'
	}
];
