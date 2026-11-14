import { describe, expect, test } from 'bun:test';
import { cutRows, type CutRowNames } from './cutRows';
import { settle, type Evidence } from './settlement';

const names: CutRowNames = {
	devlogIds: ['devlog1', 'devlog2', 'devlog3'],
	clipIds: ['clip1', 'clip2'],
	commitHashes: { commit1: 'abcdef1234567' },
	people: { maker1: 'User 1', maker2: 'User 2' }
};

const soloEvidence: Evidence = {
	commits: [{ id: 'commit1', codingSeconds: 1800 }],
	devlogs: [
		{ id: 'devlog1', seconds: 3600 },
		{ id: 'devlog2', seconds: 7200 },
		{ id: 'devlog3', seconds: 600 }
	],
	clips: [
		{ id: 'clip1', lengthSeconds: 900 },
		{ id: 'clip2', lengthSeconds: 1200 }
	],
	ship: { hackatimeSeconds: 5000, afterLastCommitSeconds: 0, programSeconds: 300 },
	collaborators: []
};

const cutsFor = (requested: unknown, evidence: Evidence) =>
	cutRows(settle(requested, evidence).adjustments, evidence, names);

describe('cutRows', () => {
	test('nothing cut lists nothing', () => {
		expect(cutsFor({}, soloEvidence)).toEqual([]);
	});

	test('lists each cut row with what it kept and what it captured', () => {
		const cuts = cutsFor(
			{ devlogs: { devlog2: 3600 }, clips: { clip2: 0 }, hackatime: { hackatime: 4000 } },
			soloEvidence
		);
		expect(cuts).toEqual([
			{
				kind: 'hackatime',
				rowId: 'hackatime',
				label: 'Hackatime',
				capturedSeconds: 5000,
				creditedSeconds: 4000
			},
			{
				kind: 'devlogs',
				rowId: 'devlog2',
				label: 'Devlog entry 2',
				capturedSeconds: 7200,
				creditedSeconds: 3600
			},
			{
				kind: 'clips',
				rowId: 'clip2',
				label: 'Timelapse 2',
				capturedSeconds: 1200,
				creditedSeconds: 0
			}
		]);
	});

	test('a request at or above the captured time is not a cut', () => {
		expect(cutsFor({ devlogs: { devlog1: 3600, devlog3: 9999 } }, soloEvidence)).toEqual([]);
	});

	test('a row that is no longer on the ship is dropped', () => {
		expect(cutsFor({ devlogs: { devlog9: 60 } }, soloEvidence)).toEqual([]);
	});

	test('the seconds taken off add up to what the settlement lost', () => {
		const requested = { devlogs: { devlog1: 1000, devlog2: 1 }, program: { program: 0 } };
		const cuts = cutsFor(requested, soloEvidence);
		const takenOff = cuts.reduce((sum, row) => sum + row.capturedSeconds - row.creditedSeconds, 0);
		expect(takenOff).toBe(
			settle({}, soloEvidence).approvedSeconds - settle(requested, soloEvidence).approvedSeconds
		);
	});

	test('a collaborative ship names whose tracked time was cut', () => {
		const evidence: Evidence = {
			...soloEvidence,
			collaborators: [
				{ makerId: 'maker1', hackatimeSeconds: 3000, afterLastCommitSeconds: 0, programSeconds: 0 },
				{ makerId: 'maker2', hackatimeSeconds: 2000, afterLastCommitSeconds: 0, programSeconds: 0 }
			]
		};
		expect(cutsFor({ hackatime: { maker2: 500 } }, evidence)).toEqual([
			{
				kind: 'hackatime',
				rowId: 'maker2',
				label: 'Hackatime, User 2',
				capturedSeconds: 2000,
				creditedSeconds: 500
			}
		]);
	});

	test('commit rows only count when commits are what settles', () => {
		const lostCapture: Evidence = {
			...soloEvidence,
			ship: { hackatimeSeconds: 0, afterLastCommitSeconds: 400, programSeconds: 0 }
		};
		expect(cutsFor({ commits: { commit1: 600 } }, soloEvidence)).toEqual([]);
		expect(cutsFor({ commits: { commit1: 600 }, after: { after: 100 } }, lostCapture)).toEqual([
			{
				kind: 'commits',
				rowId: 'commit1',
				label: 'Commit abcdef1',
				capturedSeconds: 1800,
				creditedSeconds: 600
			},
			{
				kind: 'after',
				rowId: 'after',
				label: 'Time after the last commit',
				capturedSeconds: 400,
				creditedSeconds: 100
			}
		]);
	});
});
