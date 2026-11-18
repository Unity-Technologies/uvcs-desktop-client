import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspacePillTip, workspaceKindChip, workspaceKindWords } from './workspaceKindWords';

describe('workspaceKindChip', () => {
  it('shows no chip for a standard workspace, nor one whose kind is still unread', () => {
    expect(workspaceKindChip('standard')).toBeNull();
    expect(workspaceKindChip(undefined)).toBeNull();
  });

  it('names a partial and a dynamic workspace', () => {
    expect(workspaceKindChip('partial')?.label).toBe('Partial');
    expect(workspaceKindChip('dynamic')?.label).toBe('Dynamic');
  });
});

describe('workspaceKindWords', () => {
  it('names every kind, standard included, for the details', () => {
    expect((['standard', 'partial', 'dynamic'] as const).map((kind) => workspaceKindWords(kind).label)).toEqual(['Standard', 'Partial', 'Dynamic']);
  });
});

describe('workspacePillTip', () => {
  const path = join('projects', 'game');

  it('says the kind only when it is not standard', () => {
    expect(workspacePillTip({ name: 'game', repository: 'game@local', path, kind: 'standard' }).text).toBe('game · game@local');
    expect(workspacePillTip({ name: 'game', repository: 'game@local', path, kind: 'partial' }).text).toBe('game · game@local · Partial workspace');
  });

  it('says no kind when it is unknown', () => {
    expect(workspacePillTip({ name: 'game', repository: 'game@local', path }).text).toBe('game · game@local');
  });

  it('shows where the workspace is on disk below', () => {
    expect(workspacePillTip({ name: 'game', repository: 'game@local', path, kind: 'standard' })).toEqual({ text: 'game · game@local', sub: path });
  });
});
