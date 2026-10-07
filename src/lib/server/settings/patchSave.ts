import { loadSettingsProgram, settingsValuesOf } from './values';
import { applySettingsPatch, privateEntriesFrom, settingsFormFrom } from './patch';
import { saveSettings, type SettingsResult } from './save';

export async function patchSettings(
	programId: string,
	actor: App.SessionUser,
	patch: Record<string, unknown>,
	privateInput?: unknown
): Promise<SettingsResult> {
	const { program, outbound } = await loadSettingsProgram(programId);
	if (!program) return { ok: false, status: 404, error: 'Program not found.' };
	const patched = applySettingsPatch(settingsValuesOf(program, outbound), patch);
	if (!patched.ok) return { ok: false, status: 400, error: patched.error };
	const privateEntries = privateEntriesFrom(privateInput);
	if (!privateEntries.ok) return { ok: false, status: 400, error: privateEntries.error };
	return saveSettings(programId, actor, settingsFormFrom(patched.values, privateEntries.entries));
}
