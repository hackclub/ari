import type { DocField } from '$lib/components/docs/types';

export const outboundFields: DocField[] = [
	{
		name: 'event',
		type: 'string',
		description: 'Which event this is. One of the names above.'
	},
	{
		name: 'decision',
		type: 'string | null (optional)',
		description:
			'The outcome: `approved`, `changes`, or `rejected`. It is null for `review.reverted` and `review.requeued`, and omitted on `ship.updated`.'
	},
	{ name: 'id', type: 'string', description: "Ari's own ID for the submission." },
	{
		name: 'external_id',
		type: 'string',
		description: 'The project ID you sent when you ingested the ship.'
	},
	{
		name: 'priority',
		type: 'boolean',
		description:
			'Only sent when priority review is turned on in your program settings. True when the maker requested priority review for this ship through your priority form, so you can treat priority ships differently on your side. It only appears on deliveries built by the review flow; automatic system events (auto rejections, fraud relays, evidence refreshes) leave it out.'
	},
	{
		name: 'maker',
		type: 'object',
		description:
			"The ship's maker, as `email`, current per-ship `name`, and `slack_id`. Present on review events."
	},
	{
		name: 'ship',
		type: 'object',
		description:
			'The current editable ship snapshot: `title`, `description`, `track`, `thumbnail_url`, `authors` (email and name), `repo_url`, `demo_url`, and `hackatime_projects`. Present on `ship.updated` and every review delivery.'
	},
	{
		name: 'edited_by',
		type: 'object',
		description:
			'Only on `ship.updated`. The reviewer who saved the correction, as `email` and `slack_id`.'
	},
	{
		name: 'changes',
		type: 'object[]',
		description:
			'Only on `ship.updated`. Field-level audit entries with `field`, `old_value`, and `new_value`. `field` is one of `title`, `track`, `description`, `thumbnail_url`, `author_names`, `repo_url`, `demo_url`, or `hackatime_projects`. Values are strings, string arrays for `author_names` and `hackatime_projects`, or null when a field was empty.'
	},
	{
		name: 'collaborators',
		type: 'object[]',
		description:
			"Only on collaborative ships. The list of people on the ship, each with `email`, `name`, `slack_id`, `hackatime_id`, and (on a decision) their settled `approved_minutes`, `approved_hours`, `approved_seconds`, `minutes_breakdown`, and `seconds_breakdown` (both breakdowns include a `program` slice for program-added time). The `hackatime` slice is that person's tracked Hackatime coding time on the ship's linked projects over the evidence window (lapse-deduped, AI-discounted) - not commit-anchored, so tracked time counts for them even when the git author email on their commits does not match their account. The per-person numbers are present on approve, changes, and reject (all zero on an auto-reject) and absent on reverts and requeues. When the reviewer wrote someone a personal note, that entry also carries its own `note_to_maker`; show it to that person instead of the shared `review.note_to_maker`, which stays the fallback for everyone without one. Solo ships leave this out entirely, and `maker` stays the same for backward compatibility. The entries, and `ship.authors`, come in one fixed order per ship that carries no meaning (it is not the order the ship listed them): match people by `email`, never by position."
	},
	{
		name: 'collaborators[].approved_seconds',
		type: 'integer',
		description:
			"This person's settled time in whole seconds. It sits immediately after their `approved_hours` and is present whenever their `approved_minutes` is. This is the exact figure; their `approved_minutes` and `approved_hours` are rounded views of it, derived the same way as on `review`."
	},
	{
		name: 'collaborators[].seconds_breakdown',
		type: 'object',
		description:
			"This person's `approved_seconds` by source, as integer `hackatime`, `journals`, `lapse`, and `program`. It sits immediately after their `minutes_breakdown`, is present whenever that is, and sums to their `approved_seconds`."
	},
	{
		name: 'review',
		type: 'object',
		description:
			"The review itself: `approved_minutes`, `approved_hours`, `approved_seconds`, `minutes_breakdown`, `seconds_breakdown` (each breakdown has `hackatime`, `journals`, `lapse`, and `program` for program-added time), `note_to_maker`, `audit_note`, `justification`, `fields`, and `reviewer`. The `hackatime` slice is the tracked Hackatime coding time on the ship's linked projects over the evidence window (lapse-deduped, AI-discounted) - commits are verification context, not the hours themselves. The time fields are there on every decision and gone on reverts and requeues. On `review.changes` and `review.rejected` they still carry the time the reviewer settled while deciding (after any reduction), exactly as on an approval, including when a held approval is turned into changes or a rejection at the second pass: nothing was credited, so read `decision` before you credit `approved_seconds`. `note_to_maker` is the message for the maker, `audit_note` is the reviewer's own note, `fields` holds the answers to any custom review fields, and `reviewer` is who decided (`email` and `slack_id`). Automatic system decisions carry zeroed `approved_minutes`, `approved_hours`, and `approved_seconds`, and no `minutes_breakdown` or `seconds_breakdown`."
	},
	{
		name: 'review.approved_seconds',
		type: 'integer',
		description:
			'The settled time for the whole ship in whole seconds, after any reviewer reduction and any time the fraud team removed. It sits immediately after `review.approved_hours` and is present whenever `review.approved_minutes` is. This is the exact figure and the one new integrations should read. `approved_minutes` and `approved_hours` are rounded views of it kept for compatibility: `approved_minutes` is `approved_seconds` rounded to the nearest minute (half a minute rounds up), and `approved_hours` is `approved_minutes` divided by 60, rounded to one decimal. Reviews decided before Ari settled in seconds report their minute value × 60.'
	},
	{
		name: 'review.seconds_breakdown',
		type: 'object',
		description:
			'`approved_seconds` by source, as integer `hackatime`, `journals`, `lapse`, and `program`. It sits immediately after `review.minutes_breakdown`, is present whenever that is, and sums to `approved_seconds`. `minutes_breakdown` is the compatibility view: `approved_minutes` split across the same four sources in proportion to their seconds, so it always sums to `approved_minutes`. Because each slice is rounded as part of that split, a `minutes_breakdown` slice can differ by a minute from its seconds slice divided by 60. Reviews decided before Ari settled in seconds report each minute slice × 60.'
	},
	{
		name: 'review.justification',
		type: 'object',
		description:
			'Sent while hours justification is on, which it is for every program by default (an org admin can turn it off for a program, in which case this key disappears). The evidence behind the hours and what the reviewer wrote about them, for your Override Hours Spent Justification. `hackatime_projects` lists each tracked project with the dates it was counted over, comma-separated, as "name M/D/YYYY-M/D/YYYY". `hackatime_user_id` is the submitter\'s numeric Hackatime id, and comes only when the ship tracked time on Hackatime. `lapse_links` is the timelapse URLs, comma-separated. `technical_features` is what the reviewer said the project has that accounts for the hours. `deflation_reason` is why the hours were cut, and is only there when they were. Any part with nothing to report is left out, and the whole object is left out when no part has anything. Reverts, requeues and auto-rejections carry no reviewer wording, so on those you get the evidence parts on their own, or no justification at all when the ship has neither Hackatime projects nor timelapses. Ari no longer sends `unified_db_record`, the write-up it used to generate on hardware decisions: build your own from these fields. `time_evidence`, `supporting_evidence`, `hours_reasoning`, and `additional_justification` are no longer collected either. Each one is sent only for a review recorded before that change that has it, when that review is confirmed or resent. This is internal: the maker never sees it.'
	},
	{
		name: 'fraud',
		type: 'object',
		description:
			"Only on `review.fraud`. The result of the extra fraud check. `verdict` is `passed` or `failed` for the whole ship. `checks` is a list with one entry per maker, each with their `email`, `slack_id`, a `trust_score` from 1 to 10 (higher is better), and a short `justification` in plain words. Reviews recorded since the fraud team started recording removed time also have `deflate_seconds`, the integer seconds they removed (`0` when they removed nothing), and on those `justification` is their reason for the removal; entries without `deflate_seconds` were reviewed before that. On the methods that check before the ship is decided, that time is already taken out of the decision's `approved_seconds`; on `review.fraud` the ship was already decided, so subtract it yourself if you credit it. Read `verdict` for the outcome rather than interpreting the score yourself. On this event `decision` is null and `review` just carries the system reviewer with an empty note."
	}
];
