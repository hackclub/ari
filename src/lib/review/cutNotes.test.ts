import { describe, expect, test } from 'bun:test';
import { addNote, dropNote, planCutNotes, readOfferedNotes } from './cutNotes';

const first = '20m was taken off automatically.';
const second = '1h was taken off outside this review.';

describe('addNote and dropNote', () => {
	test('a note fills an empty reason and goes on its own line after anything else', () => {
		expect(addNote('', first)).toBe(first);
		expect(addNote('  \n', first)).toBe(first);
		expect(addNote('Idle time in the journal.\n', first)).toBe(
			`Idle time in the journal.\n${first}`
		);
	});

	test('a note already in the reason is not written twice', () => {
		const reason = `Idle time.\n${first}`;
		expect(addNote(reason, first)).toBe(reason);
		expect(addNote(reason, '')).toBe(reason);
	});

	test('dropping a note leaves the rest of the reason as it was', () => {
		expect(dropNote(first, first)).toBe('');
		expect(dropNote(`Idle time.\n${first}`, first)).toBe('Idle time.');
		expect(dropNote(`${first}\nIdle time.`, first)).toBe('Idle time.');
		expect(dropNote(`Idle time.\n${first}\n${second}`, first)).toBe(`Idle time.\n${second}`);
		expect(dropNote('Idle time.', first)).toBe('Idle time.');
		expect(dropNote('Idle time.', '')).toBe('Idle time.');
	});
});

describe('notes that overlap', () => {
	const longer = '1h 30m was taken off outside this review.';
	const shorter = '30m was taken off outside this review.';

	test('a note is written even when another line contains its words', () => {
		expect(addNote(longer, shorter)).toBe(`${longer}\n${shorter}`);
	});

	test('dropping a note never cuts into another line', () => {
		expect(dropNote(longer, shorter)).toBe(longer);
		expect(dropNote(`${longer}\n${shorter}`, shorter)).toBe(longer);
		expect(dropNote(`Because ${shorter}`, shorter)).toBe(`Because ${shorter}`);
	});

	test('a note of several lines is matched and dropped as a whole', () => {
		const pair = `${shorter}\n${first}`;
		expect(addNote(`Idle time.\n${pair}`, pair)).toBe(`Idle time.\n${pair}`);
		expect(dropNote(`Idle time.\n${pair}`, pair)).toBe('Idle time.');
		expect(dropNote(`Idle time.\n${shorter}`, pair)).toBe(`Idle time.\n${shorter}`);
	});
});

describe('readOfferedNotes', () => {
	test('reads a stored list and nothing else', () => {
		expect(readOfferedNotes(JSON.stringify([first, second]))).toEqual([first, second]);
		expect(readOfferedNotes(JSON.stringify([first, 3, null]))).toEqual([first]);
		expect(readOfferedNotes(JSON.stringify({ note: first }))).toEqual([]);
		expect(readOfferedNotes('not json')).toEqual([]);
		expect(readOfferedNotes(null)).toEqual([]);
	});
});

describe('planCutNotes', () => {
	test('every note is written into a reason that does not have it yet', () => {
		expect(planCutNotes({ notes: [first, second], offered: [], reason: '' })).toEqual({
			reason: `${first}\n${second}`,
			offered: [first, second]
		});
		expect(planCutNotes({ notes: [first], offered: [], reason: 'Idle time.' })).toEqual({
			reason: `Idle time.\n${first}`,
			offered: [first]
		});
	});

	test('a note the reviewer reworded or removed is not written again', () => {
		const reworded = 'Twenty minutes came off before this review.';
		expect(planCutNotes({ notes: [first], offered: [first], reason: reworded })).toEqual({
			reason: reworded,
			offered: [first]
		});
	});

	test('a note that arrives later joins the ones already offered', () => {
		expect(planCutNotes({ notes: [first, second], offered: [first], reason: first })).toEqual({
			reason: `${first}\n${second}`,
			offered: [first, second]
		});
	});

	test('a cut that is gone takes its untouched sentence with it', () => {
		expect(
			planCutNotes({ notes: [second], offered: [first, second], reason: `${first}\n${second}` })
		).toEqual({ reason: second, offered: [second] });
		expect(planCutNotes({ notes: [], offered: [first], reason: `Idle time.\n${first}` })).toEqual({
			reason: 'Idle time.',
			offered: []
		});
	});

	test('an emptied reason is filled again: it could not be sent empty', () => {
		expect(planCutNotes({ notes: [first], offered: [first], reason: '  ' })).toEqual({
			reason: first,
			offered: [first]
		});
	});

	test('with no cut the reason is left alone', () => {
		expect(planCutNotes({ notes: [], offered: [], reason: 'Idle time.' })).toEqual({
			reason: 'Idle time.',
			offered: []
		});
	});
});
