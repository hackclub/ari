import { describe, expect, test } from 'bun:test';
import type { SettingsValues } from '$lib/settingsRules';
import { parseSettingsForm } from './saveForm';
import { applySettingsPatch, privateEntriesFrom, settingsFormFrom, settingsToApi } from './patch';

const current: SettingsValues = {
	displayName: 'program1',
	iconUrl: '',
	cardBgUrl: 'https://example.com/card.png',
	trackingStartsAt: '2026-01-01',
	accepts: { commits: true, elapsed: true, devlog: false },
	collaborative: false,
	secondPass: false,
	secondPassApproved: true,
	secondPassChanges: true,
	secondPassRejected: true,
	secondPassOrganizerBypass: true,
	screenIdentity: true,
	screenHackatime: true,
	reviewersCannotReviewOwnProjects: false,
	allowDeflation: true,
	hoursJustification: true,
	reviewerReauth: false,
	reviewerReauthTtlMinutes: '60',
	priorityReview: false,
	priorityReviewMessage: '',
	reviewGoal: '50',
	reviewersChannel: 'C0123ABCDEF',
	outUrl: '',
	outEnabled: true
};

const patched = (patch: Record<string, unknown>) => {
	const result = applySettingsPatch(current, patch);
	if (!result.ok) throw new Error(result.error);
	return result.values;
};

describe('settings patch', () => {
	test('a read sent back as a patch changes nothing', () => {
		expect(patched(settingsToApi(current))).toEqual(current);
	});

	test('only the named settings change, under their api names', () => {
		const values = patched({
			name: ' program2 ',
			evidence: ['devlog'],
			outboundUrl: 'https://example.com/hook',
			outboundEnabled: false,
			reviewGoal: 25,
			secondPass: true
		});
		expect(values).toEqual({
			...current,
			displayName: 'program2',
			accepts: { commits: false, elapsed: false, devlog: true },
			outUrl: 'https://example.com/hook',
			outEnabled: false,
			reviewGoal: '25',
			secondPass: true
		});
	});

	test('empty strings clear urls and the channel', () => {
		const values = patched({ cardBgUrl: '', reviewersChannel: '' });
		expect(values.cardBgUrl).toBe('');
		expect(values.reviewersChannel).toBe('');
	});

	test('wrong types and unknown settings are refused', () => {
		const refusals: [Record<string, unknown>, string][] = [
			[{ secondPass: 'yes' }, 'secondPass must be true or false.'],
			[{ reviewGoal: '25' }, 'reviewGoal must be a whole number.'],
			[{ reviewGoal: 2.5 }, 'reviewGoal must be a whole number.'],
			[{ name: 4 }, 'name must be a string.'],
			[{ evidence: 'commits' }, 'evidence must be an array.'],
			[{ evidence: ['video'] }, 'Unknown evidence kinds: video.'],
			[{ fraudThreshold: 3 }, 'Unknown settings: fraudThreshold.']
		];
		for (const [patch, error] of refusals) {
			expect(applySettingsPatch(current, patch)).toEqual({ ok: false, error });
		}
	});

	test('the patched values survive the settings form round trip', () => {
		const values = patched({ evidence: ['commits', 'devlog'], priorityReview: true });
		const parsed = parseSettingsForm(settingsFormFrom(values));
		expect(parsed.ok && parsed.settings.values).toEqual(values);
	});

	test('private entries ride along, and may not shadow a public setting', () => {
		const entries = privateEntriesFrom({ cardOne: 'on' });
		expect(entries).toEqual({ ok: true, entries: { cardOne: 'on' } });
		expect(settingsFormFrom(current, { cardOne: 'on' }).get('cardOne')).toBe('on');
		expect(privateEntriesFrom(undefined)).toEqual({ ok: true, entries: {} });
		expect(privateEntriesFrom({ secondPass: 'on' }).ok).toBe(false);
		expect(privateEntriesFrom({ accept_commits: 'on' }).ok).toBe(false);
		expect(privateEntriesFrom({ cardOne: true }).ok).toBe(false);
		expect(privateEntriesFrom(['on']).ok).toBe(false);
	});
});
