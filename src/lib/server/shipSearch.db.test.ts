import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { db } from '$lib/server/db';
import { reviewFixtures } from '$lib/server/review/reviewTestFixtures';
import { GET as searchEndpoint } from '../../routes/p/[program]/search/+server';
import { matchedDetail, searchShipCandidates, searchWords } from './shipSearch';

const fixtures = reviewFixtures('shipSearch');
const { programId, prefix } = fixtures;
const ids = { first: '', second: '', shared: '', other: '' };
let member: App.SessionUser;
let rosterViewer: App.SessionUser;

const searchAs = async (user: App.SessionUser, query: string) => {
	const response = await searchEndpoint({
		url: new URL(`http://localhost/p/${programId}/search?q=${encodeURIComponent(query)}`),
		params: { program: programId },
		locals: { user, sessionId: null }
	} as never);
	return (await response.json()) as { subs: { id: string }[]; people: { email: string }[] };
};
const found = async (query: string) =>
	(await searchShipCandidates(programId, query)).map((candidate) => candidate.id);
const written = async (query: string) =>
	(await searchShipCandidates(programId, query))
		.filter((candidate) => candidate.exact)
		.map((candidate) => candidate.id);

beforeAll(async () => {
	await fixtures.setup();
	member = await fixtures.user('Member');
	rosterViewer = await fixtures.user('RosterViewer', { permissions: ['VIEW_REVIEWERS'] });
	ids.first = (await fixtures.ship('Lantern', { makerEmail: `${prefix}maker1@example.com` })).id;
	ids.second = (await fixtures.ship('Compass')).id;
	ids.shared = (await fixtures.ship('Harbor', { collaborative: true })).id;
	ids.other = (await fixtures.ship('Lanyard')).id;
	const owner = await db.submission.findUniqueOrThrow({ where: { id: ids.first } });
	await db.maker.update({
		where: { id: owner.makerId },
		data: { slackId: `${prefix}Slack1`, hackatimeUserId: `${prefix}Hackatime1` }
	});
	// a second ship by the same person, to list everything of theirs
	await db.submission.update({ where: { id: ids.second }, data: { makerId: owner.makerId } });
	await db.submission.update({
		where: { id: ids.first },
		data: {
			repoUrl: `https://github.com/${prefix}/lantern`,
			demoUrl: `https://${prefix}.example.com/lantern`
		}
	});
});

afterAll(fixtures.cleanup);

describe('ship search', () => {
	test('finds a title, typed right or nearly right', async () => {
		expect(await found('Lantern')).toContain(ids.first);
		expect(await found('lanttern ship')).toContain(ids.first);
		expect(await found('lanyard')).not.toContain(ids.shared);
	});

	test('finds a repo or demo link however it was copied', async () => {
		expect(await written(`https://github.com/${prefix}/lantern.git`)).toEqual([ids.first]);
		expect(await written(`github.com/${prefix}/lantern/`)).toEqual([ids.first]);
		expect(await written(`${prefix}.example.com/lantern`)).toEqual([ids.first]);
	});

	test('an email, slack id, hackatime id or name lists every ship of that person', async () => {
		for (const query of [
			`${prefix}maker1@example.com`,
			`${prefix}Slack1`,
			`${prefix}hackatime1`,
			'LanternOne'
		]) {
			const candidates = await searchShipCandidates(programId, query);
			const theirs = candidates.filter((candidate) => candidate.byPerson);
			expect(theirs.map((candidate) => candidate.id).sort()).toEqual(
				[ids.first, ids.second].sort()
			);
		}
	});

	test('a collaborator counts as a person on the ship', async () => {
		const candidates = await searchShipCandidates(programId, 'HarborTwo');
		expect(candidates.filter((candidate) => candidate.byPerson).map((entry) => entry.id)).toEqual([
			ids.shared
		]);
	});

	test('tells a written match from a close one', async () => {
		const close = await searchShipCandidates(programId, 'lanttern');
		expect(close.find((candidate) => candidate.id === ids.first)?.exact).toBe(false);
		const typed = await searchShipCandidates(programId, 'lantern');
		expect(typed.find((candidate) => candidate.id === ids.first)?.exact).toBe(true);
	});

	test('stays inside the program, and wildcards are only text', async () => {
		expect(await searchShipCandidates(`${programId}Missing`, 'lantern')).toEqual([]);
		expect(await found('%')).toEqual([]);
		expect(await found('___')).toEqual([]);
		expect(await found('   ')).toEqual([]);
	});

	test('words are cleaned of what a pasted link adds', () => {
		expect(searchWords(' https://example.com/project1.git  maker1 ')).toEqual([
			'example.com/project1',
			'maker1'
		]);
	});

	test('the endpoint lists members only to whoever may see the roster', async () => {
		const plain = await searchAs(member, 'RosterViewer');
		expect(plain.people).toEqual([]);
		const roster = await searchAs(rosterViewer, 'RosterViewer');
		expect(roster.people.map((person) => person.email)).toEqual([rosterViewer.email]);
		// ships are listed either way
		expect((await searchAs(member, 'Lantern')).subs.map((ship) => ship.id)).toContain(ids.first);
	});

	test('the detail is the field the words hit best', () => {
		const ship = {
			repoUrl: 'https://example.com/project25',
			demoUrl: null,
			people: [{ email: 'maker5@example.com', slackId: null, hackatimeUserId: 'hackatime5' }]
		};
		expect(matchedDetail('maker5@example.com', ship)).toBe('maker5@example.com');
		expect(matchedDetail('example.com/project25', ship)).toBe('https://example.com/project25');
		expect(matchedDetail('hackatime5', ship)).toBe('hackatime5');
		expect(matchedDetail('Maker 5', ship)).toBe('maker5@example.com');
		expect(matchedDetail('ship 5', ship)).toBe(null);
	});
});
