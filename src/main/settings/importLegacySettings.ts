import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRecentBranchesByWorkspace } from '../plasticConfig/recentBranchesConf';
import type { SettingsStore } from './SettingsStore';

/**
 * On the first run, takes what the user already set up in the official Desktop client, so the app feels like home:
 * each workspace's recent branches (`plasticgui.conf`). It only reads, and only once: `legacySettingsImported` records
 * it even when there was nothing to read, and from then on the app's own settings are the only source. The app never
 * writes the official client's files.
 */
export function importLegacySettings(settings: SettingsStore, legacyConfigFolder: string): void {
  const current = settings.get();
  if (current.legacySettingsImported) return;
  const legacyRecentBranches = readRecentBranchesByWorkspace(readLegacyFile(legacyConfigFolder, 'plasticgui.conf'));
  settings.update({
    legacySettingsImported: true,
    // What the app recorded itself wins over the official client's.
    recentBranchesByWorkspace: { ...legacyRecentBranches, ...current.recentBranchesByWorkspace },
  });
}

/** The file's text; none when it can't be read (no official client, no permission, a folder in its place). */
function readLegacyFile(folder: string, name: string): string {
  try {
    return readFileSync(join(folder, name), 'utf8');
  } catch {
    return '';
  }
}
