import { redirect } from '@sveltejs/kit';
import {
	claimShip,
	finishReviewSession,
	heartbeatShip,
	releaseShip,
	takeoverShip
} from '$lib/server/review/claimActions';
import { decideShip } from '$lib/server/review/decide';
import { toActionResult } from '$lib/server/review/guards';
import { loadReviewPage } from '$lib/server/review/load';
import { requeueShip, revertShip } from '$lib/server/review/overrides';
import { resyncShip, resyncStatus } from '$lib/server/review/resync';
import { saveReviewerNote } from '$lib/server/review/reviewerNote';
import { confirmSecondPass } from '$lib/server/review/secondPass';
import { returnSecondPass } from '$lib/server/review/secondPassReturn';
import { editShip, uploadShipImage } from '$lib/server/review/shipEdit';
import { launchVm, stopVm } from '$lib/server/review/vmActions';
import { dismissWarning } from '$lib/server/review/warnings';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals, url }) => {
	const { programId, meta } = await parent();
	return loadReviewPage({
		user: locals.user!,
		programId,
		submissionId: params.id,
		url,
		meta
	});
};

function signedIn(locals: App.Locals): App.SessionUser {
	if (!locals.user) throw redirect(303, '/login');
	return locals.user;
}

export const actions: Actions = {
	claim: async ({ params, locals }) =>
		toActionResult(await claimShip(signedIn(locals), params.program, params.id)),
	takeover: async ({ params, locals }) =>
		toActionResult(await takeoverShip(signedIn(locals), params.program, params.id)),
	heartbeat: ({ params, locals }) => heartbeatShip(locals.user, params.program, params.id),
	release: ({ params, locals }) => releaseShip(locals.user, params.id),
	finishSession: ({ params, locals }) =>
		finishReviewSession(locals.user, params.program, params.id),

	uploadImage: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await uploadShipImage(user, params.program, params.id, await request.formData())
		);
	},
	editShip: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await editShip(user, params.program, params.id, await request.formData())
		);
	},
	dismiss: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await dismissWarning(user, params.program, params.id, await request.formData())
		);
	},
	saveReviewerNote: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await saveReviewerNote(user, params.program, params.id, await request.formData())
		);
	},

	approve: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await decideShip('approved', user, params.program, params.id, await request.formData())
		);
	},
	changes: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await decideShip('changes', user, params.program, params.id, await request.formData())
		);
	},
	reject: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await decideShip('rejected', user, params.program, params.id, await request.formData())
		);
	},

	revert: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await revertShip(user, params.program, params.id, await request.formData())
		);
	},
	requeue: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await requeueShip(user, params.program, params.id, await request.formData())
		);
	},

	launchVm: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await launchVm(user, params.program, params.id, await request.formData())
		);
	},
	stopVm: async ({ params, locals }) =>
		toActionResult(await stopVm(signedIn(locals), params.program, params.id)),

	resync: async ({ params, locals }) =>
		toActionResult(await resyncShip(signedIn(locals), params.program, params.id)),
	resyncStatus: async ({ params, locals }) =>
		toActionResult(await resyncStatus(locals.user, params.program, params.id)),

	confirmSecondPass: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		const form = await request.formData().catch(() => null);
		return toActionResult(await confirmSecondPass(user, params.program, params.id, form));
	},
	returnSecondPass: async ({ params, locals, request }) => {
		const user = signedIn(locals);
		return toActionResult(
			await returnSecondPass(user, params.program, params.id, await request.formData())
		);
	}
};
