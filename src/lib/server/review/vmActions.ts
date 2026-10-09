import type { ActionOutcome } from '$lib/review/reviewTypes';
import { requirePermission } from '$lib/server/authz';
import { canActOnSubmission } from '$lib/server/claims';
import { encrypt } from '$lib/server/crypto';
import { db } from '$lib/server/db';
import { createVm, deleteVm, isVmType, rdpUri, teardownVms, vmConfigured } from '$lib/server/vm';
import { assertAccess, assertCanAct, done, lockedRefusal, refuse } from '$lib/server/review/guards';

export async function launchVm(
	user: App.SessionUser,
	programId: string,
	submissionId: string,
	form: FormData
): Promise<ActionOutcome<{ success: true }>> {
	// the gate runs before the platform check, so who may act never depends on configuration
	const ship = await assertCanAct(user, programId, submissionId);
	if (!vmConfigured()) return refuse(400, 'vmUnavailable', 'The VM platform is not configured.');
	const type = String(form.get('type') ?? '');
	if (!isVmType(type))
		return refuse(400, 'invalid', 'Pick a VM type (linux, windows, or android).');

	const program = await db.program.findUniqueOrThrow({
		where: { id: programId },
		select: { allowVms: true }
	});
	if (!program.allowVms)
		return refuse(403, 'vmUnavailable', 'This program has reviewer VMs turned off.');
	requirePermission(user, programId, 'USE_VMS');
	if (ship.track !== 'software')
		return refuse(400, 'vmUnavailable', 'Reviewer VMs are only available for software ships.');
	if (ship.status !== 'pending' && ship.status !== 'secondpass')
		return refuse(400, 'shipClosed', 'This ship is already reviewed. VMs are for ships in review.');
	if (!(await canActOnSubmission(submissionId, user.id))) return lockedRefusal();

	const ownVm = { submissionId_reviewerId: { submissionId, reviewerId: user.id } };
	const existing = await db.reviewerVm.findUnique({ where: ownVm, select: { vmid: true } });
	if (existing) {
		// the slot is freed whatever the platform says: the tombstone sweep retries the delete
		teardownVms([existing.vmid]);
		await db.reviewerVm.deleteMany({ where: { submissionId, reviewerId: user.id } });
	}

	// the reviewer must be the exact sign-in email: it scopes the vm to them
	const created = await createVm(type, user.email);
	if (!created.ok) {
		// a create that timed out may still have provisioned a vm
		console.warn(`[vm] launch failed for ${user.email} (${type}): ${created.error}`);
		return refuse(502, 'vmFailed', created.error);
	}
	const machine = created.vm;

	try {
		await db.$transaction([
			db.reviewerVm.create({
				data: {
					submissionId,
					reviewerId: user.id,
					programId,
					vmid: machine.vmid,
					vmType: type,
					name: machine.name,
					guacUrl: machine.guacUrl,
					rdpUri:
						machine.rdp && machine.rdpUsername ? rdpUri(machine.rdp, machine.rdpUsername) : null,
					rdpPasswordEnc: machine.rdpPassword ? encrypt(machine.rdpPassword) : null
				}
			}),
			db.activityEvent.create({
				data: {
					programId,
					kind: 'VM',
					actorId: user.id,
					submissionId,
					text: `Launched a ${type} VM for review`,
					meta: { op: 'launch', type, vmid: machine.vmid, name: machine.name }
				}
			})
		]);
	} catch (caught) {
		// without its row nothing else could ever delete the vm just created
		teardownVms([machine.vmid]);
		if ((caught as { code?: string })?.code === 'P2002')
			return refuse(409, 'vmFailed', 'A VM is already running for this ship. Refresh to see it.');
		throw caught;
	}
	return done({ success: true });
}

// keyed by the caller and the route's program, so it only ever reaches a vm they own there
export async function stopVm(
	user: App.SessionUser,
	programId: string,
	submissionId: string
): Promise<ActionOutcome<{ success: true }>> {
	assertAccess(user, programId);
	const row = await db.reviewerVm.findFirst({
		where: { submissionId, reviewerId: user.id, programId },
		select: { vmid: true, vmType: true }
	});
	if (!row) return done({ success: true });
	// the row stays when the platform could not confirm, so the vmid survives for a retry
	if (!(await deleteVm(row.vmid)))
		return refuse(502, 'vmFailed', 'Could not reach the VM platform to delete the VM. Try again.');
	await db.$transaction([
		db.reviewerVm.deleteMany({ where: { submissionId, reviewerId: user.id } }),
		db.activityEvent.create({
			data: {
				programId,
				kind: 'VM',
				actorId: user.id,
				submissionId,
				text: 'Deleted the review VM',
				meta: { op: 'stop', type: row.vmType, vmid: row.vmid }
			}
		})
	]);
	return done({ success: true });
}
