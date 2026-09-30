import { join } from 'node:path';
import type { CmClient } from '../../cm/CmClient';
import type { SettingsStore } from '../../settings/SettingsStore';
import { memorySettings } from '../../settings/testing/memorySettings';
import { LeftChangesFinder } from '../leftChanges';
import { SwitchShelveRecords } from '../switchShelveRecords';
import type { SwitchDependencies } from '../switchWithChanges';

/**
 * What the switch and shelve flows work with, over `cm` (a `playAlongWorkspace`'s): the app's real records and left
 * changes, kept in `settings`, and a backups folder next to the workspace. `recordOf` finds a shelve's record.
 */
export function playAlongDependencies(cm: CmClient, workspacePath: string, settings: SettingsStore = memorySettings()) {
  const records = new SwitchShelveRecords(settings);
  const leftChanges = new LeftChangesFinder(cm, records);
  const deps: SwitchDependencies = { cm, settings, records, leftChanges, backupsRoot: join(workspacePath, '..', 'backups') };
  return { deps, records, leftChanges, recordOf: (shelveId: number) => records.find({ shelveId, repository: 'eco@local' }) };
}
