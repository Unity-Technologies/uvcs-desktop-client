import type { BranchPin, ExplorerRule, UserColors } from '@shared/domain/branchExplorerSettings';
import type { RepositorySettings, ServerSettings } from '@shared/domain/scopedSettings';
import type { WindowKeptSettings } from '@shared/domain/settings';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { queryClient } from '../queryClient';

// What a window's storage (`localStorage`) kept before the app's settings held it, brought to the settings by the
// first window that starts (`bringStoredWindowSettings`), which take it only where they hold nothing yet: the Branch
// Explorer's rules, moved branches and colors, the sync remotes and the home screen's projects. Each key is removed
// once the settings took it, so a window that can't save them tries again at its next start.

/** Where the Branch Explorer's store puts what it kept per repository and for everyone, when it migrates to version 3. */
export const BRANCH_EXPLORER_KEPT_KEY = 'branch-explorer-kept';
/** The `localStorage` keys of the stores that kept a sync remote per repository and a project per server. */
export const SYNC_TARGETS_KEY = 'sync-targets';
export const HOME_PROJECT_PICKS_KEY = 'home-project-picks';

const KEPT_KEYS = [BRANCH_EXPLORER_KEPT_KEY, SYNC_TARGETS_KEY, HOME_PROJECT_PICKS_KEY];

/** What the Branch Explorer's preferences kept per repository and for everyone, before version 3. */
export interface BranchExplorerKept {
  rulesByRepository?: Record<string, ExplorerRule[]>;
  rulesOff?: Record<string, true>;
  userColors?: UserColors;
  userColorsOff?: Record<string, true>;
  pinsByRepository?: Record<string, BranchPin[]>;
}

const NOTHING_KEPT: WindowKeptSettings = { repositorySettings: {}, serverSettings: {}, changesetColors: { users: [] } };

/** The settings the Branch Explorer's remembered preferences held, before the app's settings held them. */
export function keptByBranchExplorer(persisted: unknown): WindowKeptSettings {
  const { rulesByRepository = {}, rulesOff = {}, userColors, userColorsOff = {}, pinsByRepository = {} } = (persisted ?? {}) as BranchExplorerKept;
  const repositorySettings: Record<string, RepositorySettings> = {};
  const add = (repository: string, settings: RepositorySettings) => (repositorySettings[repository] = { ...repositorySettings[repository], ...settings });
  for (const [repository, rules] of Object.entries(rulesByRepository)) add(repository, { explorerRules: rules });
  for (const repository of Object.keys(rulesOff)) add(repository, { explorerRulesOff: true });
  for (const repository of Object.keys(userColorsOff)) add(repository, { changesetColorsOff: true });
  for (const [repository, pins] of Object.entries(pinsByRepository)) add(repository, { branchPins: pins });
  return { ...NOTHING_KEPT, repositorySettings, changesetColors: userColors ?? NOTHING_KEPT.changesetColors };
}

/**
 * What the window's storage kept, as it keeps it: the Branch Explorer's as its migration put it aside, the sync
 * remotes and home projects as their stores left them (`{ state, version }`); null when it keeps none of them.
 */
export function keptInStorage(storage: Pick<Storage, 'getItem'>): WindowKeptSettings | null {
  const [explorer, syncTargets, projectPicks] = KEPT_KEYS.map((key) => storage.getItem(key));
  if (explorer === null && syncTargets === null && projectPicks === null) return null;
  const explorerKept = keptByBranchExplorer(parsed(explorer));
  const remotes = parsed<{ state?: { remoteByRepository?: Record<string, string> } }>(syncTargets)?.state?.remoteByRepository ?? {};
  const picks = parsed<{ state?: { picks?: Record<string, string> } }>(projectPicks)?.state?.picks ?? {};
  const repositorySettings = { ...explorerKept.repositorySettings };
  for (const [repository, syncRemote] of Object.entries(remotes)) repositorySettings[repository] = { ...repositorySettings[repository], syncRemote };
  const serverSettings = Object.fromEntries(Object.entries(picks).map(([server, homeProject]): [string, ServerSettings] => [server, { homeProject }]));
  return { ...explorerKept, repositorySettings, serverSettings };
}

/** Brings what this window's storage kept to the settings, then forgets it there; kept for the next start when they can't take it. */
export async function bringStoredWindowSettings(storage: Storage = localStorage): Promise<void> {
  const kept = keptInStorage(storage);
  if (kept === null) return;
  try {
    queryClient.setQueryData(queryKeys.settings, await api.settings.addWindowSettings(kept));
  } catch (error) {
    console.warn('[settings] What this window kept stays in its storage until the next start:', error);
    return;
  }
  for (const key of KEPT_KEYS) storage.removeItem(key);
}

function parsed<T = unknown>(stored: string | null): T | null {
  try {
    return stored === null ? null : (JSON.parse(stored) as T);
  } catch {
    return null;
  }
}
