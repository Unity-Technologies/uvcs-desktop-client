import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolOutcome, MergeToolRequest } from '@shared/domain/mergeTools';
import { WORKSPACE_ROLES, type MergeLabels } from '../mergeDescription';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { resolveInMergeTool } from './resolveInMergeTool';

const vsCode: MergeTool = { id: 'vscode', name: 'VS Code', origin: 'known', executable: 'code', args: [], defaultArgs: [], canBringToFront: false };
const labels: MergeLabels = { source: '/main', destination: '/main/task', roles: WORKSPACE_ROLES };

const prefab = (changes: Partial<FileConflictState> = {}): FileConflictState => ({
  file: { key: '/Assets/Player.prefab', path: 'Assets/Player.prefab', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
  status: 'ready',
  isBinary: false,
  decidedByUser: false,
  resolution: null,
  mergedAutomatically: false,
  remainingConflicts: 1,
  ...changes,
});

/** Resolves the file, the main process answering `outcome`; the request it got. */
async function resolve(state: FileConflictState, outcome: MergeToolOutcome) {
  fakeApi.answer('mergeTools.resolve', async () => outcome);
  const session = await resolveInMergeTool('/wk', state, vsCode, labels, () => undefined, true);
  const [[, request]] = fakeApi.argsOf('mergeTools.resolve') as [[string, MergeToolRequest]];
  return { session, request };
}

describe('resolveInMergeTool', () => {
  it('lets Smart Merge try a file nothing was decided for, and marks the file as its when it merged it', async () => {
    const { session, request } = await resolve(prefab(), { kind: 'resolved', text: 'merged\n', tool: 'Smart Merge' });

    expect(request.trySmartMergeFirst).toBe(true);
    expect(session.decision).toEqual({ kind: 'text', text: 'merged\n', tool: 'Smart Merge' });
  });

  it('opens the tool straight away on a file already decided, Smart Merge’s merge included', async () => {
    const decided = prefab({ decision: { kind: 'text', text: 'merged\n', tool: 'Smart Merge' }, resolution: { choice: 'text', text: 'merged\n' } });

    const { request } = await resolve(decided, { kind: 'resolved', text: 'refined\n' });

    expect(request).toMatchObject({ trySmartMergeFirst: false, startText: 'merged\n' });
  });
});
