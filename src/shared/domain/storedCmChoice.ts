import type { AppSettings } from './settings';

type CmChoiceSettings = Pick<AppSettings, 'cmChoice' | 'cmDeclinedUpdateFor'>;

/**
 * The choice of `cm` held by settings as saved, by this version or one from before `automatic` existed
 * (docs/features/cm-runtime.md "Settings"). Those saved `cmChoice` without `cmDeclinedUpdateFor`, along with every other
 * setting (`SettingsStore` writes them all), so `managed`, then the default, can't be told apart from a choice: every
 * such choice, and `installed`, which `automatic` now does, becomes `automatic`, once. Saved with
 * `cmDeclinedUpdateFor`, `managed` is the user's own choice and stays.
 */
export function storedCmChoice(stored: Partial<Record<keyof CmChoiceSettings, unknown>>): CmChoiceSettings {
  const declinedFor = typeof stored.cmDeclinedUpdateFor === 'string' ? stored.cmDeclinedUpdateFor : null;
  const savedSinceAutomatic = stored.cmDeclinedUpdateFor !== undefined;
  return { cmChoice: savedSinceAutomatic && stored.cmChoice === 'managed' ? 'managed' : 'automatic', cmDeclinedUpdateFor: declinedFor };
}
