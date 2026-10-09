import { describe, expect, test } from 'bun:test';
import { safeReturnPath } from './returnPath';

describe('safeReturnPath', () => {
	test('keeps ordinary same-site paths with their query and hash', () => {
		expect(safeReturnPath('/programs', '/fallback')).toBe('/programs');
		expect(safeReturnPath('/p/abc/queue?track=web#top', '/fallback')).toBe(
			'/p/abc/queue?track=web#top'
		);
		expect(safeReturnPath('/', null)).toBe('/');
	});

	test('falls back on empty, relative and scheme-carrying values', () => {
		expect(safeReturnPath('', '/fallback')).toBe('/fallback');
		expect(safeReturnPath(null, '/fallback')).toBe('/fallback');
		expect(safeReturnPath(undefined, null)).toBeNull();
		expect(safeReturnPath('programs', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('https://evil.example/x', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('javascript:alert(1)', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/javascript:alert(1)', '/fallback')).toBe('/javascript:alert(1)');
	});

	test('refuses protocol-relative and backslash hosts', () => {
		expect(safeReturnPath('//evil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('//evil.example/path', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/\\evil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('\\/evil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/\\/evil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/ok\\later', '/fallback')).toBe('/fallback');
	});

	test('refuses control characters and encoded tricks that still resolve same-site', () => {
		expect(safeReturnPath('/\tevil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/\n/evil.example', '/fallback')).toBe('/fallback');
		expect(safeReturnPath('/%2F%2Fevil.example', '/fallback')).toBe('/%2F%2Fevil.example');
	});
});
