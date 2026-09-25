import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import { WORKSPACE_ROLES, type MergeLabels } from '../mergeDescription';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { decisionFromTool, toolOutcomeMessage, toolVersionNames, waitsForTool } from './mergeToolOutcome';

const labels: MergeLabels = { source: '/main', destination: '/main/task', roles: WORKSPACE_ROLES };

describe('decisionFromTool', () => {
  it('takes saved text or the version kept, marked as the tool’s', () => {
    expect(decisionFromTool({ kind: 'resolved', text: 'x\n' }, 'VS Code')).toEqual({ kind: 'text', text: 'x\n', tool: 'VS Code' });
    expect(decisionFromTool({ kind: 'keptSide', side: 'source' }, 'UVCS merge tool')).toEqual({ kind: 'wholeFile', side: 'source', tool: 'UVCS merge tool' });
    expect(decisionFromTool({ kind: 'unchanged', exitCode: 0, errorOutput: '' }, 'VS Code')).toBeUndefined();
  });
});

describe('toolOutcomeMessage', () => {
  it('confirms a clean result, and points at conflicts left in it', () => {
    expect(toolOutcomeMessage({ kind: 'resolved', text: 'x\n' }, 'VS Code', 'a.ts', labels)).toMatchObject({ kind: 'success', title: 'Resolved a.ts in VS Code' });
    expect(toolOutcomeMessage({ kind: 'resolved', text: '<<<<<<< a\nx\n=======\ny\n>>>>>>> b\n' }, 'VS Code', 'a.ts', labels)).toMatchObject({
      kind: 'info',
      title: 'a.ts still has 1 conflict',
    });
  });

  it('says nothing changed when the tool closed without saving, with its error if it failed', () => {
    expect(toolOutcomeMessage({ kind: 'unchanged', exitCode: 0, errorOutput: '' }, 'KDiff3', 'a.ts', labels)).toEqual({
      kind: 'info',
      title: 'KDiff3 closed without saving a.ts',
      detail: 'It still needs your decision.',
    });
    expect(toolOutcomeMessage({ kind: 'unchanged', exitCode: 2, errorOutput: 'warning\nbad option -x\n' }, 'KDiff3', 'a.ts', labels).detail).toBe(
      'It still needs your decision. bad option -x',
    );
    expect(toolOutcomeMessage({ kind: 'unchanged', exitCode: null, errorOutput: '' }, 'KDiff3', 'a.ts', labels).title).toBe('Stopped waiting for KDiff3');
  });

  it('names the version a binary keeps', () => {
    expect(toolOutcomeMessage({ kind: 'keptSide', side: 'destination' }, 'UVCS merge tool', 'a.png', labels).detail).toBe('Keeping your version.');
  });
});

describe('toolVersionNames', () => {
  it('names the versions with their role and branch', () => {
    expect(toolVersionNames(labels)).toEqual({ base: 'Base', yours: 'Yours (/main/task)', incoming: 'Incoming (/main)' });
  });
});

describe('waitsForTool', () => {
  const tool: MergeTool = {
    id: 'vscode',
    name: 'VS Code',
    origin: 'known',
    executable: 'code',
    args: [],
    defaultArgs: [],
    mergesBinaries: false,
    extensions: null,
    canBringToFront: false,
  };
  const state = (changes: Partial<FileConflictState>): FileConflictState => ({
    file: { key: '/a.ts', path: 'a.ts', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
    status: 'ready',
    isBinary: false,
    decidedByUser: false,
    resolution: null,
    mergedAutomatically: false,
    remainingConflicts: 1,
    ...changes,
  });

  it('takes the files still waiting for the user that the tool can open', () => {
    expect(waitsForTool(state({}), tool)).toBe(true);
    expect(waitsForTool(state({ resolution: { choice: 'source' } }), tool)).toBe(false);
    expect(waitsForTool(state({ status: 'loading' }), tool)).toBe(false);
    expect(waitsForTool(state({ openTool: { sessionId: 's', toolName: 'VS Code', canBringToFront: false } }), tool)).toBe(false);
    expect(waitsForTool(state({ isBinary: true }), tool)).toBe(false);
    expect(waitsForTool(state({ isBinary: true }), { ...tool, mergesBinaries: true })).toBe(true);
  });
});
