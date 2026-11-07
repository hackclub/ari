import { expect, test } from 'bun:test';
import { decisionFormBody, draftFromUnknown, readDecisionForm } from './decisionForm';
import type { Evidence } from './settlement';
import { previewSettlement } from './settlementPreview';

const solo: Evidence = {
	commits: [{ id: 'commitOne', codingSeconds: 5000 }],
	devlogs: [{ id: 'devlogOne', seconds: 1830 }],
	clips: [{ id: 'clipOne', lengthSeconds: 29 }],
	ship: { hackatimeSeconds: 5429, afterLastCommitSeconds: 0, programSeconds: 0 },
	collaborators: []
};

const pair: Evidence = {
	commits: [],
	devlogs: [{ id: 'devlogOne', seconds: 600, makerId: 'makerOne' }],
	clips: [],
	ship: { hackatimeSeconds: 3000, afterLastCommitSeconds: 0, programSeconds: 0 },
	collaborators: [
		{ makerId: 'makerOne', hackatimeSeconds: 2000, afterLastCommitSeconds: 0, programSeconds: 0 },
		{ makerId: 'makerTwo', hackatimeSeconds: 1000, afterLastCommitSeconds: 0, programSeconds: 0 },
		{ makerId: 'makerIdle', hackatimeSeconds: 0, afterLastCommitSeconds: 0, programSeconds: 0 }
	]
};

const request = (overrides = {}) => ({
	adjustments: {},
	deflateSeconds: null,
	collaboratorDeflates: {},
	allowDeflation: true,
	...overrides
});

test('an untouched ship reports exactly what was captured', () => {
	const preview = previewSettlement(solo, request());
	expect(preview.capturedSeconds).toBe(7288); // 5429 + 1830 + 29
	expect(preview.settlement.approvedSeconds).toBe(7288);
	expect(preview.reported.approvedSeconds).toBe(7288);
	expect(preview.deflateSeconds).toBeNull();
	expect(preview.deflated).toBe(false);
});

test('row reductions and a flat deflate settle to exact seconds', () => {
	const preview = previewSettlement(
		solo,
		request({ adjustments: { devlogs: { devlogOne: 1000 } }, deflateSeconds: 458 })
	);
	expect(preview.settlement.approvedSeconds).toBe(6458); // 5429 + 1000 + 29
	expect(preview.settlement.adjustments.devlogs).toEqual({ devlogOne: 1000 });
	expect(preview.deflateSeconds).toBe(458);
	expect(preview.reported.approvedSeconds).toBe(6000); // 6458 - 458
	const sources = preview.reported.breakdown;
	expect(sources.hackatime + sources.journals + sources.lapse + sources.program).toBe(6000);
	expect(preview.deflated).toBe(true);
});

test('a request can only reduce, and a flat deflate never exceeds the total', () => {
	const preview = previewSettlement(
		solo,
		request({ adjustments: { devlogs: { devlogOne: 99999 } }, deflateSeconds: 999999 })
	);
	expect(preview.settlement.approvedSeconds).toBe(7288);
	expect(preview.settlement.adjustments.devlogs).toEqual({});
	expect(preview.deflateSeconds).toBe(7288);
	expect(preview.reported.approvedSeconds).toBe(0);
});

test('with deflation off nothing posted cuts the captured time', () => {
	const preview = previewSettlement(
		pair,
		request({
			adjustments: { hackatime: { makerOne: 0 } },
			deflateSeconds: 500,
			collaboratorDeflates: { makerTwo: 500 },
			allowDeflation: false
		})
	);
	expect(preview.settlement.approvedSeconds).toBe(3600); // 2000 + 1000 tracked + 600 journal
	expect(preview.reported.approvedSeconds).toBe(3600);
	expect(preview.deflateSeconds).toBeNull();
	expect(preview.collaboratorDeflates).toEqual({});
	expect(preview.deflated).toBe(false);
});

test('per-person cuts replace the flat deflate and name everyone, even at zero', () => {
	const preview = previewSettlement(
		pair,
		request({ deflateSeconds: 100, collaboratorDeflates: { makerTwo: 5000, stranger: 50 } })
	);
	expect(preview.collaboratorDeflates).toEqual({ makerTwo: 1000 }); // clamped to the 1000 makerTwo tracked
	expect(preview.deflateSeconds).toBe(1000);
	expect(preview.reported.approvedSeconds).toBe(2600); // 3600 - 1000
	expect(preview.reported.collaborators.makerOne.total).toBe(2600);
	expect(preview.reported.collaborators.makerTwo.total).toBe(0);
	expect(preview.reported.collaborators.makerIdle.total).toBe(0);
	expect(Object.keys(preview.settlement.collaborators).sort()).toEqual([
		'makerIdle',
		'makerOne',
		'makerTwo'
	]);
});

test('a decision form round-trips a draft in seconds', () => {
	const draft = draftFromUnknown({
		note: 'Note',
		audit: 'Audit',
		technicalFeatures: 'Features',
		adjustments: { devlogs: { devlogOne: 1000 } },
		deflateSeconds: 458,
		collaboratorDeflates: { makerTwo: 30, zero: 0, bad: 'x' },
		collaboratorNotes: { makerTwo: 'Hi', odd: 3 },
		fieldValues: { level: 'Gold', tags: ['one'] },
		checks: [true, 'true', false],
		fixChecks: ['reviewOne', 4]
	});
	expect(draft.collaboratorDeflates).toEqual({ makerTwo: 30 });
	expect(draft.collaboratorNotes).toEqual({ makerTwo: 'Hi' });
	expect(draft.checks).toEqual([true, false, false]);
	expect(draft.fixChecks).toEqual(['reviewOne']);

	const form = new FormData();
	for (const [key, value] of Object.entries(decisionFormBody(draft, 7))) form.set(key, value);
	const parsed = readDecisionForm(form);
	expect(parsed.draft).toEqual(draft);
	expect(parsed.ingestVersion).toBe(7);
	expect(parsed.posted.has('adjustments')).toBe(true);
});

test('a malformed form reads as empty, never as a number it did not carry', () => {
	const form = new FormData();
	form.set('adjustments', '{not json');
	form.set('deflateSeconds', '12.9');
	form.set('ingestVersion', 'abc');
	const parsed = readDecisionForm(form);
	expect(parsed.draft.adjustments).toEqual({});
	expect(parsed.posted.has('adjustments')).toBe(false);
	expect(parsed.draft.deflateSeconds).toBe(12);
	expect(parsed.ingestVersion).toBeNull();
	expect(readDecisionForm(new FormData()).draft.deflateSeconds).toBeNull();
	expect(draftFromUnknown(null).note).toBe('');
});

test('a fixed deduction comes off after the reviewer deflate and is not theirs', () => {
	const preview = previewSettlement(
		{ ...solo, deductionsSeconds: { makerSolo: 1800 } },
		request({ deflateSeconds: 288 })
	);
	expect(preview.settlement.approvedSeconds).toBe(7288);
	expect(preview.deflateSeconds).toBe(288);
	expect(preview.deductedSeconds).toBe(1800);
	expect(preview.reported.approvedSeconds).toBe(5200); // 7288 - 288 - 1800
	const breakdown = preview.reported.breakdown;
	expect(breakdown.hackatime + breakdown.journals + breakdown.lapse + breakdown.program).toBe(5200);
});

test('a fixed deduction applies even when deflation is off', () => {
	const preview = previewSettlement(
		{ ...solo, deductionsSeconds: { makerSolo: 3600 } },
		request({ deflateSeconds: 1000, allowDeflation: false })
	);
	expect(preview.deflateSeconds).toBeNull();
	expect(preview.deflated).toBe(false);
	expect(preview.deductedSeconds).toBe(3600);
	expect(preview.reported.approvedSeconds).toBe(3688); // 7288 - 3600
});

test('a fixed deduction never takes more than what is left', () => {
	const preview = previewSettlement(
		{ ...solo, deductionsSeconds: { makerSolo: 99999 } },
		request({ deflateSeconds: 7000 })
	);
	expect(preview.deductedSeconds).toBe(288); // 7288 - 7000
	expect(preview.reported.approvedSeconds).toBe(0);
});

test('a teammate deduction comes off only their share', () => {
	const preview = previewSettlement({ ...pair, deductionsSeconds: { makerTwo: 400 } }, request());
	expect(preview.deductedSeconds).toBe(400);
	expect(preview.reported.approvedSeconds).toBe(3200); // 3000 + 600 - 400
	expect(preview.reported.collaborators.makerTwo.total).toBe(600); // 1000 - 400
	expect(preview.reported.collaborators.makerOne.total).toBe(2600); // 2000 + 600
});

test('no deduction leaves the reported time untouched', () => {
	const preview = previewSettlement({ ...solo, deductionsSeconds: {} }, request());
	expect(preview.deductedSeconds).toBe(0);
	expect(preview.reported.approvedSeconds).toBe(7288);
});

test('on a solo ship the maker deduction comes off the whole ship, not their attributed rows', () => {
	const attributed: Evidence = {
		...solo,
		devlogs: [{ id: 'devlogOne', seconds: 1830, makerId: 'makerSolo' }],
		deductionsSeconds: { makerSolo: 3600 }
	};
	const preview = previewSettlement(attributed, request());
	expect(preview.deductedSeconds).toBe(3600);
	expect(preview.reported.approvedSeconds).toBe(3688); // 7288 - 3600
});

test('a cut on someone no longer on the ship comes off nobody', () => {
	const preview = previewSettlement(
		{ ...pair, deductionsSeconds: { makerTwo: 400, makerGone: 900 } },
		request()
	);
	expect(preview.deductedSeconds).toBe(400);
	expect(preview.reported.collaborators.makerOne.total).toBe(2600); // 2000 + 600, untouched
	expect(preview.reported.collaborators.makerTwo.total).toBe(600); // 1000 - 400
});
