import { describe, expect, test } from 'bun:test';
import { Prisma } from '$db';
import { splitProportional, toLegacyMinutes } from '$lib/time';
import { applyDeflate, settle, type PersonSeconds } from '$lib/review/settlement';
import {
	draftColumns,
	evidenceFromRows,
	legacyMinutes,
	replayStoredReview,
	reviewColumns,
	storedApprovedSeconds,
	storedDeductedSeconds,
	type SettlementRows
} from './settlementStore';

const soloRows: SettlementRows = {
	commits: [],
	devlogs: [{ id: 'devlogOne', seconds: 1830, makerId: null }],
	clips: [{ id: 'clipOne', lengthSeconds: 29, makerId: null }],
	hours: { hackatimeSeconds: 5429, afterLastCommitSeconds: 0, programSeconds: 0 },
	collaborators: []
};

const duoRows: SettlementRows = {
	commits: [],
	devlogs: [{ id: 'devlogOne', seconds: 1830, makerId: 'makerAda' }],
	clips: [{ id: 'clipOne', lengthSeconds: 29, makerId: 'makerBob' }],
	hours: { hackatimeSeconds: 8429, afterLastCommitSeconds: 0, programSeconds: 601 },
	collaborators: [
		{ makerId: 'makerAda', hackatimeSeconds: 5429, afterLastCommitSeconds: 0, programSeconds: 301 },
		{ makerId: 'makerBob', hackatimeSeconds: 3000, afterLastCommitSeconds: 0, programSeconds: 300 }
	]
};

const sourcesOf = (person: PersonSeconds) => [
	person.hackatime,
	person.journals,
	person.lapse,
	person.program
];

describe('evidenceFromRows', () => {
	test('reads only the seconds columns', () => {
		const row = {
			...duoRows,
			devlogs: [{ id: 'devlogOne', seconds: 1830, minutes: 999, makerId: 'makerAda' }],
			hours: {
				hackatimeSeconds: 8429,
				hackatimeMinutes: 999,
				afterLastCommitSeconds: 7,
				programSeconds: 601
			}
		};
		expect(evidenceFromRows(row)).toEqual({
			commits: [],
			devlogs: [{ id: 'devlogOne', seconds: 1830, makerId: 'makerAda' }],
			clips: [{ id: 'clipOne', lengthSeconds: 29, makerId: 'makerBob' }],
			ship: { hackatimeSeconds: 8429, afterLastCommitSeconds: 7, programSeconds: 601 },
			collaborators: duoRows.collaborators!
		});
	});

	test('a ship with no capture yet settles to zero', () => {
		const evidence = evidenceFromRows({ commits: [], devlogs: [], clips: [], hours: null });
		expect(evidence.ship).toEqual({
			hackatimeSeconds: 0,
			afterLastCommitSeconds: 0,
			programSeconds: 0
		});
		expect(settle({}, evidence).approvedSeconds).toBe(0);
	});
});

describe('reviewColumns', () => {
	test('the shared contract vector', () => {
		const settlement = settle({}, evidenceFromRows(soloRows));
		expect(settlement.breakdown).toEqual({
			hackatime: 5429,
			journals: 1830,
			lapse: 29,
			program: 0
		});
		expect(legacyMinutes(settlement.approvedSeconds, settlement.breakdown)).toEqual({
			total: 121,
			hackatime: 90,
			journals: 30,
			lapse: 1,
			program: 0
		});
		expect(reviewColumns(settlement)).toEqual({
			settlementVersion: 3,
			approvedSeconds: 7288,
			adjustmentsSeconds: {
				devlogs: {},
				clips: {},
				hackatime: {},
				program: {},
				commits: {},
				after: {}
			},
			collaboratorSeconds: {},
			deflateSeconds: null,
			collaboratorDeflatesSeconds: Prisma.DbNull,
			deductionsSeconds: Prisma.DbNull,
			approvedMinutes: 121,
			adjustments: {},
			collaboratorMinutes: {},
			deflateMinutes: null,
			collaboratorDeflates: Prisma.DbNull
		});
	});

	test('a ship-level deflate is clamped and dual-written', () => {
		const settlement = settle({}, evidenceFromRows(soloRows));
		expect(reviewColumns(settlement, { deflateSeconds: 89 })).toMatchObject({
			approvedSeconds: 7288,
			deflateSeconds: 89,
			deflateMinutes: 1
		});
		expect(reviewColumns(settlement, { deflateSeconds: 999999 }).deflateSeconds).toBe(7288);
		expect(reviewColumns(settlement, { deflateSeconds: 0 }).deflateSeconds).toBeNull();
		expect(reviewColumns(settlement, { deflateSeconds: '60' }).deflateSeconds).toBeNull();
	});

	test('per-person deflates win and their legacy minutes sum to deflateMinutes', () => {
		const settlement = settle({ hackatime: { makerAda: 5000 } }, evidenceFromRows(duoRows));
		const columns = reviewColumns(settlement, {
			deflateSeconds: 7,
			collaboratorDeflates: { makerAda: 50, makerBob: 50, makerNobody: 900 }
		});
		expect(columns.adjustmentsSeconds).toMatchObject({ hackatime: { makerAda: 5000 } });
		expect(columns.adjustments).toEqual({});
		expect(columns.deflateSeconds).toBe(100);
		expect(columns.collaboratorDeflatesSeconds).toEqual({ makerAda: 50, makerBob: 50 });
		expect(columns.deflateMinutes).toBe(2);
		expect(columns.collaboratorDeflates).toEqual({ makerAda: 1, makerBob: 1 });
		expect(columns.collaboratorSeconds).toEqual(settlement.collaborators);
	});

	test('legacy columns always agree with the contract derivation', () => {
		let seed = 2026;
		const next = (limit: number) => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed % limit;
		};
		for (let round = 0; round < 500; round++) {
			const rows: SettlementRows = {
				commits: [],
				devlogs: [
					{ id: 'devlogOne', seconds: next(20000), makerId: 'makerAda' },
					{ id: 'devlogTwo', seconds: next(20000), makerId: 'makerBob' }
				],
				clips: [{ id: 'clipOne', lengthSeconds: next(9000), makerId: 'makerBob' }],
				hours: { hackatimeSeconds: 0, afterLastCommitSeconds: 0, programSeconds: next(7000) },
				collaborators: [
					{
						makerId: 'makerAda',
						hackatimeSeconds: next(50000),
						afterLastCommitSeconds: 0,
						programSeconds: next(100)
					},
					{
						makerId: 'makerBob',
						hackatimeSeconds: next(50000),
						afterLastCommitSeconds: 0,
						programSeconds: next(100)
					}
				]
			};
			const settlement = settle(
				{ devlogs: { devlogOne: next(20000) }, hackatime: { makerBob: next(50000) } },
				evidenceFromRows(rows)
			);
			const deflate =
				round % 2 === 0
					? { deflateSeconds: next(4000) }
					: { collaboratorDeflates: { makerAda: next(4000), makerBob: next(4000) } };
			const columns = reviewColumns(settlement, deflate);

			expect(columns.approvedMinutes).toBe(toLegacyMinutes(columns.approvedSeconds));
			expect(columns.deflateMinutes).toBe(
				columns.deflateSeconds === null ? null : toLegacyMinutes(columns.deflateSeconds)
			);
			for (const [makerId, person] of Object.entries(settlement.collaborators)) {
				const minutes = columns.collaboratorMinutes[makerId];
				const [hackatime, journals, lapse, program] = splitProportional(
					toLegacyMinutes(person.total),
					sourcesOf(person)
				);
				expect(minutes).toEqual({
					total: toLegacyMinutes(person.total),
					hackatime,
					journals,
					lapse,
					program
				});
				expect(hackatime + journals + lapse + program).toBe(minutes.total);
			}
			if (columns.collaboratorDeflates !== Prisma.DbNull) {
				const legacySum = Object.values(columns.collaboratorDeflates).reduce(
					(sum, minutes) => sum + minutes,
					0
				);
				expect(legacySum).toBe(columns.deflateMinutes!);
			}

			// what was stored replays to exactly what the decision settled
			const replayed = replayStoredReview(
				{
					adjustmentsSeconds: columns.adjustmentsSeconds,
					deflateSeconds: columns.deflateSeconds,
					collaboratorDeflatesSeconds:
						columns.collaboratorDeflatesSeconds === Prisma.DbNull
							? null
							: columns.collaboratorDeflatesSeconds
				},
				rows
			);
			const decided = applyDeflate(
				settlement,
				columns.deflateSeconds,
				deflate.collaboratorDeflates
			);
			expect(replayed.approvedSeconds).toBe(decided.approvedSeconds);
			expect(replayed.breakdown).toEqual(decided.breakdown);
			expect(replayed.approvedSeconds).toBe(
				columns.approvedSeconds - (columns.deflateSeconds ?? 0)
			);
		}
	});
});

describe('replayStoredReview', () => {
	test('lists every collaborator, even one with nothing settled', () => {
		const replayed = replayStoredReview(
			{ adjustmentsSeconds: {}, deflateSeconds: null, collaboratorDeflatesSeconds: null },
			{
				commits: [],
				devlogs: [],
				clips: [],
				hours: { hackatimeSeconds: 60, afterLastCommitSeconds: 0, programSeconds: 0 },
				collaborators: [
					{
						makerId: 'makerAda',
						hackatimeSeconds: 60,
						afterLastCommitSeconds: 0,
						programSeconds: 0
					},
					{ makerId: 'makerBob', hackatimeSeconds: 0, afterLastCommitSeconds: 0, programSeconds: 0 }
				]
			}
		);
		expect(replayed.collaborators.makerBob).toEqual({
			total: 0,
			hackatime: 0,
			journals: 0,
			lapse: 0,
			program: 0
		});
	});
});

describe('storedApprovedSeconds', () => {
	test('a minute-based review is read from its minutes', () => {
		expect(
			storedApprovedSeconds({ settlementVersion: 2, approvedMinutes: 90, approvedSeconds: 0 })
		).toBe(5400);
		expect(
			storedApprovedSeconds({ settlementVersion: 3, approvedMinutes: 90, approvedSeconds: 5429 })
		).toBe(5429);
	});
});

describe('draftColumns', () => {
	test('keeps raw seconds and dual-writes minutes', () => {
		expect(
			draftColumns({
				adjustments: {
					devlogs: { devlogOne: 1830, devlogTwo: 0, devlogBad: 'x' },
					hackatime: { hackatime: 5429.9 },
					unknownKind: { row: 5 },
					clips: {}
				},
				deflateSeconds: 89,
				collaboratorDeflates: { makerAda: 5430, makerBob: 0, makerBad: null }
			})
		).toEqual({
			adjustmentsSeconds: {
				devlogs: { devlogOne: 1830, devlogTwo: 0 },
				hackatime: { hackatime: 5429 }
			},
			deflateSeconds: 89,
			collaboratorDeflatesSeconds: { makerAda: 5430 },
			adjustments: { devlogs: { devlogOne: 31, devlogTwo: 0 }, hackatime: { hackatime: 90 } },
			deflateMinutes: 1,
			collaboratorDeflates: { makerAda: 91 }
		});
	});

	test('an empty draft clears everything', () => {
		expect(draftColumns({})).toEqual({
			adjustmentsSeconds: {},
			deflateSeconds: null,
			collaboratorDeflatesSeconds: {},
			adjustments: {},
			deflateMinutes: null,
			collaboratorDeflates: {}
		});
	});
});

describe('fixed deductions', () => {
	test('are snapshotted on the review and replayed after the deflate', () => {
		const settlement = settle({}, evidenceFromRows(soloRows));
		const columns = reviewColumns(settlement, {
			deflateSeconds: 288,
			deductions: { makerSolo: 1800, makerNone: 0 }
		});
		expect(columns.approvedSeconds).toBe(7288);
		expect(columns.deductionsSeconds).toEqual({ makerSolo: 1800 });
		const stored = {
			adjustmentsSeconds: columns.adjustmentsSeconds,
			deflateSeconds: columns.deflateSeconds,
			collaboratorDeflatesSeconds: null,
			deductionsSeconds: columns.deductionsSeconds
		};
		expect(replayStoredReview(stored, soloRows).approvedSeconds).toBe(5200); // 7288 - 288 - 1800
		expect(storedDeductedSeconds(stored, soloRows)).toBe(1800);
	});

	test('a review recorded without any replays as before', () => {
		const settlement = settle({}, evidenceFromRows(soloRows));
		const stored = {
			adjustmentsSeconds: settlement.adjustments,
			deflateSeconds: null,
			collaboratorDeflatesSeconds: null
		};
		expect(replayStoredReview(stored, soloRows).approvedSeconds).toBe(7288);
		expect(storedDeductedSeconds(stored, soloRows)).toBe(0);
	});
});
