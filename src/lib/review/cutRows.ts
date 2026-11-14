import {
	afterLastCommitKey,
	programKey,
	soloHackatimeKey,
	type Adjustments,
	type Evidence
} from '$lib/review/settlement';

export interface CutRow {
	kind: keyof Adjustments;
	rowId: string;
	label: string;
	capturedSeconds: number;
	creditedSeconds: number;
}

export interface CutRowNames {
	devlogIds: string[];
	clipIds: string[];
	commitHashes: Record<string, string>;
	people: Record<string, string>;
}

// takes adjustments already clamped by settle, so every entry is a real cut on a live row
export function cutRows(
	adjustments: Required<Adjustments>,
	evidence: Evidence,
	names: CutRowNames
): CutRow[] {
	const rows: CutRow[] = [];
	const add = (kind: keyof Adjustments, rowId: string, label: string, capturedSeconds: number) => {
		const creditedSeconds = adjustments[kind][rowId];
		if (creditedSeconds === undefined) return;
		rows.push({ kind, rowId, label, capturedSeconds, creditedSeconds });
	};
	const numbered = (ids: string[], rowId: string, name: string) => {
		const position = ids.indexOf(rowId);
		return position >= 0 ? `${name} ${position + 1}` : name;
	};

	add('hackatime', soloHackatimeKey, 'Hackatime', evidence.ship.hackatimeSeconds);
	for (const person of evidence.collaborators)
		add(
			'hackatime',
			person.makerId,
			`Hackatime, ${names.people[person.makerId] ?? 'collaborator'}`,
			person.hackatimeSeconds
		);
	for (const commit of evidence.commits)
		add(
			'commits',
			commit.id,
			// 7: the short hash the commit tile shows
			`Commit ${(names.commitHashes[commit.id] ?? commit.id).slice(0, 7)}`,
			commit.codingSeconds
		);
	add(
		'after',
		afterLastCommitKey,
		'Time after the last commit',
		evidence.ship.afterLastCommitSeconds
	);
	for (const devlog of evidence.devlogs)
		add('devlogs', devlog.id, numbered(names.devlogIds, devlog.id, 'Devlog entry'), devlog.seconds);
	for (const clip of evidence.clips)
		add('clips', clip.id, numbered(names.clipIds, clip.id, 'Timelapse'), clip.lengthSeconds);
	add('program', programKey, 'Program-added', evidence.ship.programSeconds);
	return rows;
}
