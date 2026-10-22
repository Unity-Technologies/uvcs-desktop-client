import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLegacyMergeTools } from '../plasticConfig/clientConfMergeTools';
import { readRecentBranchesByWorkspace } from '../plasticConfig/recentBranchesConf';
import { legacyMergeToolSettings } from './legacyMergeTools';
import type { SettingsStore } from './SettingsStore';

/**
 * On the first run, takes what the user already set up in the official Desktop client, so the app feels like home:
 * each workspace's recent branches (`plasticgui.conf`) and which merge tool opens which files (`client.conf`). It only
 * reads, and each only once: `legacySettingsImported` and `mergeToolRulesImported` record it even when there was
 * nothing to read, and from then on the app's own settings are the only source. The app never writes the official
 * client's files.
 */
export function importLegacySettings(settings: SettingsStore, legacyConfigFolder: string): void {
  importRecentBranches(settings, legacyConfigFolder);
  importMergeTools(settings, legacyConfigFolder);
}

function importRecentBranches(settings: SettingsStore, legacyConfigFolder: string): void {
  const current = settings.get();
  if (current.legacySettingsImported) return;
  const legacyRecentBranches = readRecentBranchesByWorkspace(readLegacyFile(legacyConfigFolder, 'plasticgui.conf'));
  settings.update({
    legacySettingsImported: true,
    // What the app recorded itself wins over the official client's.
    recentBranchesByWorkspace: { ...legacyRecentBranches, ...current.recentBranchesByWorkspace },
  });
}

/** Imported apart from the recent branches, which came first: a user who ran the app before still gets it, once. */
function importMergeTools(settings: SettingsStore, legacyConfigFolder: string): void {
  const current = settings.get();
  if (current.mergeToolRulesImported) return;
  const entries = readLegacyMergeTools(readLegacyFile(legacyConfigFolder, 'client.conf'));
  settings.update({ mergeToolRulesImported: true, ...(entries && legacyMergeToolSettings(entries, current)) });
}

/** The file's text; none when it can't be read (no official client, no permission, a folder in its place). */
function readLegacyFile(folder: string, name: string): string {
  try {
    return readFileSync(join(folder, name), 'utf8');
  } catch {
    return '';
  }
}
