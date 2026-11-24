import type { CmChoice } from './cmRuntime';
import type { AppSettings } from './settings';

type CmChoiceSettings = Pick<AppSettings, 'cmChoice' | 'cmDeclinedUpdateFor'>;

const CHOICES: readonly CmChoice[] = ['automatic', 'installed', 'managed'];

/**
 * The choice of `cm` held by settings as saved, by this version or one from before `automatic` existed
 * (docs/features/cm-runtime.md "Settings"). Those saved `cmChoice` without `cmDeclinedUpdateFor`, along with every other
 * setting (`SettingsStore` writes them all), so `managed`, then the default, can't be told apart from a choice: it
 * becomes `automatic`, once. `installed` was always the user's own choice, and stays. Saved with
 * `cmDeclinedUpdateFor`, every choice stays; a value this version doesn't know is the default.
 */
export function storedCmChoice(stored: Partial<Record<keyof CmChoiceSettings, unknown>>): CmChoiceSettings {
  const declinedFor = typeof stored.cmDeclinedUpdateFor === 'string' ? stored.cmDeclinedUpdateFor : null;
  const choice = CHOICES.find((known) => known === stored.cmChoice) ?? 'automatic';
  const savedBeforeAutomatic = stored.cmDeclinedUpdateFor === undefined;
  return { cmChoice: savedBeforeAutomatic && choice === 'managed' ? 'automatic' : choice, cmDeclinedUpdateFor: declinedFor };
}
