import { clampSeconds } from '$lib/time';
import { isDeflated } from '$lib/review/reviewRules';
import {
	applyDeductions,
	applyDeflate,
	clampCollaboratorDeflates,
	settle,
	type CollaboratorDeflates,
	type Evidence,
	type PersonSeconds,
	type Settlement,
	type SourceSeconds
} from '$lib/review/settlement';

export interface SettlementRequest {
	// seconds keyed by evidence row id, grouped by kind
	adjustments: unknown;
	deflateSeconds: unknown;
	// seconds keyed by makerId
	collaboratorDeflates: unknown;
	allowDeflation: boolean;
}

export interface SettlementPreview {
	// clamped against the evidence, before any deflate: what the review row stores
	settlement: Settlement;
	capturedSeconds: number;
	collaboratorDeflates: CollaboratorDeflates;
	// the cut that applies: the per-person sum when any survives the clamp, else the flat one
	deflateSeconds: number | null;
	// the fixed cuts that applied after the reviewer's own, never part of deflateSeconds
	deductedSeconds: number;
	// after the deflate and the fixed cuts: what the program is told
	reported: {
		approvedSeconds: number;
		breakdown: SourceSeconds;
		collaborators: Record<string, PersonSeconds>;
	};
	deflated: boolean;
}

const emptyPerson = (): PersonSeconds => ({
	total: 0,
	hackatime: 0,
	journals: 0,
	lapse: 0,
	program: 0
});

// the browser previews with this and the server settles with it: one code path
export function previewSettlement(
	evidence: Evidence,
	request: SettlementRequest
): SettlementPreview {
	// with deflation off nothing a client posts can cut the captured time
	const settlement = settle(request.allowDeflation ? request.adjustments : {}, evidence);
	// the program hears about every person on the ship, even at zero
	for (const person of evidence.collaborators) {
		settlement.collaborators[person.makerId] ??= emptyPerson();
	}
	const { deflates, totalSeconds: perPersonSeconds } = clampCollaboratorDeflates(
		request.allowDeflation ? request.collaboratorDeflates : {},
		settlement.collaborators
	);
	const flatSeconds = request.allowDeflation
		? clampSeconds(request.deflateSeconds, settlement.approvedSeconds) || null
		: null;
	const deflateSeconds = perPersonSeconds > 0 ? perPersonSeconds : flatSeconds;
	const deflated = applyDeflate(settlement, deflateSeconds, deflates);
	// applied even with deflation off: the reviewer did not choose it
	const reported = applyDeductions(
		deflated,
		evidence.deductionsSeconds,
		evidence.collaborators.length > 0
	);

	return {
		settlement,
		capturedSeconds: settle({}, evidence).approvedSeconds,
		collaboratorDeflates: deflates,
		deflateSeconds,
		deductedSeconds: deflated.approvedSeconds - reported.approvedSeconds,
		reported,
		deflated: isDeflated(settlement.adjustments, deflateSeconds)
	};
}
