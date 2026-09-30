import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { WORKSPACE_GUID } from '../../cm/testing/cmOutput';

/**
 * The record of changes this app left on `sourceSpec` (`br:/main/task1`, branch id 37) in the workspace of
 * `WORKSPACE_GUID`, when switching to /main; `changes` makes it another kind of record.
 */
export function leftRecord(shelveId: number, sourceSpec: string, changes: Partial<SwitchShelveRecord> = {}): SwitchShelveRecord {
  return {
    workspaceGuid: WORKSPACE_GUID,
    shelveId,
    repository: 'eco@local',
    source: { spec: sourceSpec, name: sourceSpec.slice(3), objectRef: 'br:37' },
    target: { spec: 'br:/main', name: '/main' },
    mode: 'leave',
    createdAt: '2026-09-25T21:17:30.000Z',
    paths: ['src/a.txt'],
    changelists: [],
    ...changes,
  };
}
