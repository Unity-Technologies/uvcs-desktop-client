import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { selectorPlace } from './switchSelectors';
import type { WorkspaceIdentity } from './workspaceIdentity';

/** The target of changes shelved without a switch: to update, or shelved away by the user. */
export const NO_TARGET: SwitchShelveRecord['target'] = { spec: '', name: '' };

/** Why the changes were shelved and where they go: what each flow adds to the record. */
export type ShelvePurpose = Pick<SwitchShelveRecord, 'mode' | 'reason' | 'target'> & {
  /** Where the changes were made, as the official automatic-shelve comment names it (`br:37`); empty when unknown. */
  objectRef: string;
};

/** The record of a shelve just made in `workspace`, holding `contents`: how the app finds its changes and puts them back. */
export function newShelveRecord(
  workspace: WorkspaceIdentity,
  shelveId: number,
  contents: Pick<SwitchShelveRecord, 'paths' | 'changelists'>,
  { objectRef, ...purpose }: ShelvePurpose,
): SwitchShelveRecord {
  return {
    workspaceGuid: workspace.guid,
    shelveId,
    repository: workspace.repository,
    source: { ...selectorPlace(workspace.selector), objectRef },
    ...purpose,
    createdAt: new Date().toISOString(),
    ...contents,
  };
}
