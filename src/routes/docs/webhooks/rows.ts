import type { DocRow } from '$lib/components/docs/types';

export const events: DocRow[] = [
	{
		name: 'ship.updated',
		mono: true,
		description:
			'A reviewer corrected the ship title, type (software or hardware), description, thumbnail, author names, repository, live demo, or Hackatime projects.'
	},
	{ name: 'review.approved', mono: true, description: 'A reviewer approved the ship.' },
	{
		name: 'review.changes',
		mono: true,
		description:
			'A reviewer asked for changes. Ari can also ask on its own, for example when a ship arrives without a usable Hackatime project.'
	},
	{
		name: 'review.rejected',
		mono: true,
		description:
			'A reviewer rejected the ship. Ari can also reject on its own, for example for an unreachable repo or a failed fraud check. Automatic decisions come from the system reviewer with zeroed hours.'
	},
	{
		name: 'review.reverted',
		mono: true,
		description: 'A reviewer undid a decision and took the ship back.'
	},
	{
		name: 'review.requeued',
		mono: true,
		description:
			'A decision was rolled back and the ship is on the queue again for a fresh look, either by a reviewer or by Ari after refreshing its evidence. Undo anything you did based on the original decision.'
	},
	{
		name: 'review.fraud',
		mono: true,
		description:
			'An extra fraud check finished on a ship you already approved. You only get this if you turn on fraud review and set it to the relay option. It does not change the ship, it just tells you the result so you can decide what to do.'
	}
];

export const phases: DocRow[] = [
	{ name: 'processing', description: 'Just received. Ari is still gathering evidence for it.' },
	{ name: 'fraud_review', description: 'Held while the fraud check runs.' },
	{ name: 'review', description: 'In the queue, waiting for a reviewer to pick it up.' },
	{
		name: 'under_review',
		description: 'A reviewer has claimed it and is working on it right now.'
	},
	{
		name: 'second_pass',
		description: 'A reviewer decided it, and the decision is waiting for an organizer to confirm.'
	},
	{
		name: 'reviewed',
		description: 'Decided. `decision` says which way: `approved`, `changes`, or `rejected`.'
	},
	{ name: 'withdrawn', description: 'Your program pulled it back before a decision. Final.' },
	{ name: 'reverted', description: 'A reviewer undid the decision. The project may ship again.' }
];

export const ingestResponses: DocRow[] = [
	{
		code: '202',
		ok: true,
		name: 'Accepted',
		description:
			'The ship is queued for review. The body carries its `id`; keep it for status lookups.'
	},
	{
		code: '200',
		ok: true,
		name: 'Duplicate',
		description:
			'You resent the exact same bytes within an hour while the ship was still open, so Ari ignored the retry and returned the existing id.'
	},
	{
		code: '409',
		ok: false,
		name: 'already_queued',
		description:
			'A ship for this `external_id` is still open. Ari never replaces an open ship; withdraw it first, then resend the corrected payload. A ship held for second pass cannot be withdrawn, wait for the decision instead.'
	},
	{
		code: '401',
		ok: false,
		name: 'Bad signature',
		description:
			'The signature header is missing or does not match, or `X-Ari-Timestamp` is present but is not a whole number of unix seconds within 300 seconds of the current time.'
	},
	{
		code: '404',
		ok: false,
		name: 'unknown_program',
		description: 'No program with that ID, or it has been archived.'
	},
	{
		code: '422',
		ok: false,
		name: 'Invalid payload',
		description:
			'A required field is missing or malformed. The body names it, like `{"error":"invalid_payload","field":"title"}`. Sending collaborators when collaboration is off returns `collaborators_not_enabled` instead.'
	}
];

export const withdrawResponses: DocRow[] = [
	{
		code: '200',
		ok: true,
		name: 'Withdrawn',
		description:
			'The ship was pulled off the queue. Returns `{ "status": "withdrawn", "id": "…" }`.'
	},
	{
		code: '404',
		ok: false,
		name: 'not_queued',
		description: 'Nothing open was found for that external_id, so there was nothing to withdraw.'
	},
	{
		code: '401',
		ok: false,
		name: 'Bad signature',
		description:
			'The signature header is missing or does not match, or `X-Ari-Timestamp` is present but is not a whole number of unix seconds within 300 seconds of the current time.'
	},
	{
		code: '422',
		ok: false,
		name: 'Invalid payload',
		description: 'The body is missing `external_id`.'
	}
];

export const fraudModes: DocRow[] = [
	{
		name: 'Before the queue',
		description:
			'The ship is held for the fraud check right after it comes in. If it passes, it joins the normal review queue. If it does not, Ari turns it down for you and sends a `review.rejected` with a message for the maker.'
	},
	{
		name: 'Before the second pass',
		description:
			'A reviewer approves, then the ship waits for the fraud check before the second pass. If it passes, it moves on to the second pass as usual. If it does not, you get a `review.rejected` just like above. A rejection or a request for changes does not wait for the fraud check.'
	},
	{
		name: 'Alongside the queue',
		description:
			'The fraud check starts as soon as the ship joins the review queue, and reviewers keep working on it at the same time. An approval only waits if the fraud check has not finished yet, and then it moves on to the second pass as usual. A rejection or a request for changes never waits for it. If the ship does not pass, you get a `review.rejected` just like above.'
	},
	{
		name: 'Relay (after approval)',
		description:
			'The ship is approved and sent back to you as normal, and the fraud check runs afterwards just for your information. This never changes the ship. When it is done you get a `review.fraud` event with the result, and you do whatever you want with it.'
	}
];

export const legacyTimeFields: DocRow[] = [
	{
		name: 'approved_minutes',
		mono: true,
		description:
			'`approved_seconds` rounded to the nearest whole minute, with half a minute rounding up: `floor((approved_seconds + 30) / 60)`.'
	},
	{
		name: 'approved_hours',
		mono: true,
		description: '`approved_minutes` divided by 60, rounded to one decimal place.'
	},
	{
		name: 'minutes_breakdown',
		mono: true,
		description:
			'`approved_minutes` split across `hackatime`, `journals`, `lapse`, and `program` in proportion to `seconds_breakdown`. The slices are whole minutes and always sum to `approved_minutes`.'
	}
];
