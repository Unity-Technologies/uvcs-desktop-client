import type { CmClient } from '../cm/CmClient';
import type { LeftChangesFinder } from './leftChanges';
import type { SwitchShelveRecords } from './switchShelveRecords';

/** What every flow that shelves changes out of the workspace (switch, shelve away, update) works with. */
export interface ShelveFlowDependencies {
  cm: CmClient;
  records: SwitchShelveRecords;
  /** Puts the changes back when a step fails (`finish`). */
  leftChanges: LeftChangesFinder;
  /**
   * Where files wait outside the workspace: the files the changes added, while the shelve holds them
   * (`moveNewItemsAside`), and the local versions an update merges (`updateWithMerge`).
   */
  backupsRoot: string;
}
