import { describe, expect, it } from 'vitest';
import { markedWorkspaceKind, shownWorkspaceKind, workspaceCardTip, workspaceKindChip, workspaceKindWords } from './workspaceKindWords';

describe('markedWorkspaceKind', () => {
  it('marks a partial and a dynamic workspace, never a standard one nor one whose kind is still unread', () => {
    expect(([undefined, 'standard', 'partial', 'dynamic'] as const).map(markedWorkspaceKind)).toEqual([null, null, 'partial', 'dynamic']);
  });
});

describe('shownWorkspaceKind', () => {
  it('tells the kind of a workspace whose folder is there', () => {
    expect(shownWorkspaceKind('dynamic', false)).toBe('dynamic');
  });

  it('tells no kind for a missing workspace, whose row says it is missing instead', () => {
    expect(shownWorkspaceKind('dynamic', true)).toBeUndefined();
  });
});

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

describe('workspaceCardTip', () => {
  it('says the kind only when it is not standard', () => {
    expect(workspaceCardTip({ name: 'game', repository: 'game@local', kind: 'standard' })).toBe('game · game@local');
    expect(workspaceCardTip({ name: 'game', repository: 'game@local', kind: 'partial' })).toBe('game · game@local · Partial workspace');
  });

  it('says no kind when it is unknown', () => {
    expect(workspaceCardTip({ name: 'game', repository: 'game@local' })).toBe('game · game@local');
  });
});
