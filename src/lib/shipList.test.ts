import { describe, expect, test } from 'bun:test';
import {
	listHref,
	listParam,
	newestDecidedFirst,
	pageHref,
	pageParam,
	pageSlice,
	reviewHref,
	trackParam
} from './shipList';

const at = (query: string) => new URL(`http://localhost/p/demo/queue${query}`);

describe('trackParam', () => {
	test('only real tracks pass', () => {
		expect(trackParam(at('?track=hardware'))).toBe('hardware');
		expect(trackParam(at('?track=all'))).toBeNull();
		expect(trackParam(at('?track=firmware'))).toBeNull();
		expect(trackParam(at(''))).toBeNull();
	});
});

describe('pageParam', () => {
	test('is zero-based and defaults to the first page', () => {
		expect(pageParam(at(''), 100)).toBe(0);
		expect(pageParam(at('?page=1'), 100)).toBe(0);
		expect(pageParam(at('?page=3'), 100)).toBe(2);
	});

	test('junk and out-of-range pages are clamped', () => {
		expect(pageParam(at('?page=abc'), 100)).toBe(0);
		expect(pageParam(at('?page=-4'), 100)).toBe(0);
		expect(pageParam(at('?page=99'), 100)).toBe(4);
		expect(pageParam(at('?page=5'), 0)).toBe(0);
	});
});

describe('pageSlice', () => {
	test('cuts one table page', () => {
		const rows = Array.from({ length: 30 }, (unused, index) => index);
		expect(pageSlice(rows, 0)).toHaveLength(24);
		expect(pageSlice(rows, 1)).toEqual([24, 25, 26, 27, 28, 29]);
	});
});

describe('listParam', () => {
	test('keeps only allowed values', () => {
		const allowed = ['approved', 'changes', 'rejected'];
		expect(listParam(at('?decision=rejected,withdrawn,approved'), 'decision', allowed)).toEqual([
			'approved',
			'rejected'
		]);
		expect(listParam(at(''), 'decision', allowed)).toEqual([]);
	});
});

describe('listHref', () => {
	test('a filter change resets the page and keeps other params', () => {
		expect(listHref(at('?sort=hours&page=3'), { track: 'hardware' })).toBe(
			'/p/demo/queue?sort=hours&track=hardware'
		);
	});

	test('null removes a param', () => {
		expect(listHref(at('?track=hardware'), { track: null })).toBe('/p/demo/queue');
	});

	test('pageHref keeps the filters', () => {
		expect(pageHref(at('?track=software'), 1)).toBe('/p/demo/queue?track=software&page=2');
		expect(pageHref(at('?track=software&page=2'), 0)).toBe('/p/demo/queue?track=software');
	});
});

describe('reviewHref', () => {
	test('carries the track filter', () => {
		expect(reviewHref('demo', 'ship1', null)).toBe('/p/demo/review/ship1');
		expect(reviewHref('demo', 'ship1', 'hardware')).toBe('/p/demo/review/ship1?track=hardware');
	});
});

describe('newestDecidedFirst', () => {
	const ship = (id: string, receivedAt: string) => ({ id, receivedAt: new Date(receivedAt) });

	test('orders by the decision, not by when the ship arrived', () => {
		const ships = [ship('ship1', '2026-01-03'), ship('ship2', '2026-01-01')];
		const decidedAt = new Map([
			['ship1', new Date('2026-01-04')],
			['ship2', new Date('2026-01-09')]
		]);
		expect(newestDecidedFirst(ships, decidedAt).map((entry) => entry.id)).toEqual([
			'ship2',
			'ship1'
		]);
	});

	test('a ship with no review sorts by when it arrived', () => {
		const ships = [ship('ship1', '2026-01-05'), ship('ship2', '2026-01-01')];
		const decidedAt = new Map([['ship2', new Date('2026-01-03')]]);
		expect(newestDecidedFirst(ships, decidedAt).map((entry) => entry.id)).toEqual([
			'ship1',
			'ship2'
		]);
	});

	test('ties keep a stable order', () => {
		const ships = [ship('ship2', '2026-01-01'), ship('ship1', '2026-01-01')];
		expect(newestDecidedFirst(ships, new Map()).map((entry) => entry.id)).toEqual([
			'ship1',
			'ship2'
		]);
	});
});
