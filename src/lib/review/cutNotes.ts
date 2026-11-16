const linesOf = (text: string): string[] => text.split('\n').map((line) => line.trim());

// whole lines only: one note can be the start of another, or sit inside a longer sentence
function noteStart(reason: string, note: string): number {
	if (!note.trim()) return -1;
	const wanted = linesOf(note.trim());
	const lines = linesOf(reason);
	for (let start = 0; start + wanted.length <= lines.length; start += 1)
		if (wanted.every((line, offset) => lines[start + offset] === line)) return start;
	return -1;
}

export function addNote(reason: string, note: string): string {
	if (!note.trim() || noteStart(reason, note) >= 0) return reason;
	return reason.trim() ? `${reason.trimEnd()}\n${note}` : note;
}

export function dropNote(reason: string, note: string): string {
	const start = noteStart(reason, note);
	if (start < 0) return reason;
	const lines = reason.split('\n');
	lines.splice(start, linesOf(note.trim()).length);
	return lines.join('\n').trim();
}

export function readOfferedNotes(raw: string | null): string[] {
	if (!raw) return [];
	try {
		const stored: unknown = JSON.parse(raw);
		return Array.isArray(stored)
			? stored.filter((note): note is string => typeof note === 'string')
			: [];
	} catch {
		return [];
	}
}

export interface CutNotesInput {
	notes: string[];
	// what this browser already wrote into this draft
	offered: string[];
	reason: string;
}

export interface CutNotesPlan {
	reason: string;
	offered: string[];
}

// each note is offered once: whatever the reviewer does to it afterwards stands
export function planCutNotes(input: CutNotesInput): CutNotesPlan {
	// an empty reason has nothing of the reviewer's to keep, and could not be sent anyway
	const offered = input.reason.trim() ? input.offered : [];
	let reason = input.reason;
	for (const note of offered) if (!input.notes.includes(note)) reason = dropNote(reason, note);
	for (const note of input.notes) if (!offered.includes(note)) reason = addNote(reason, note);
	return { reason, offered: input.notes };
}
