import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { moreChipLabel, queryInScope, scopeChipsFor, steppedChip, type ScopeChip, type ScopeChips } from './scopeChips';

const labels = (chips: readonly ScopeChip[]) => chips.map(({ label, prefix }) => `${label} ${prefix}`.trim());

function workspaceChips(): ScopeChips {
  return scopeChipsFor(workspacePlace('/ws'))!;
}

describe('scopeChipsFor', () => {
  it('shows All and the sections searched most in the row, the rest under More, each with its prefix', () => {
    const chips = workspaceChips();
    expect(labels(chips.row)).toEqual(['All', 'Branches br:', 'Changesets cs:', 'Files /', 'Commands >']);
    expect(labels(chips.more)).toEqual(['Labels lb:', 'Shelves sh:', 'Code reviews cr:', 'People @']);
  });

  it('leaves Files out of a repository explored without a workspace', () => {
    const chips = scopeChipsFor(repositoryPlace('game@local'))!;
    expect(labels(chips.row)).toEqual(['All', 'Branches br:', 'Changesets cs:', 'Commands >']);
    expect(labels(chips.more)).toEqual(['Labels lb:', 'Shelves sh:', 'Code reviews cr:', 'People @']);
  });

  it('shows no chips on the home screen, where only commands are searched', () => {
    expect(scopeChipsFor(null)).toBeNull();
  });
});

describe('queryInScope', () => {
  const chip = (scope: ScopeChip['scope']) => [...workspaceChips().row, ...workspaceChips().more].find((each) => each.scope === scope)!;

  it('writes the chip\'s prefix before the text typed', () => {
    expect(queryInScope('main', chip('branches'))).toBe('br:main');
    expect(queryInScope('', chip('people'))).toBe('@');
  });

  it('puts the chip\'s prefix in place of the one typed', () => {
    expect(queryInScope('cs:fix', chip('branches'))).toBe('br:fix');
    expect(queryInScope('  > switch', chip('files'))).toBe('/switch');
  });

  it('takes the prefix away for All, keeping the text', () => {
    expect(queryInScope('br:main', chip('all'))).toBe('main');
    expect(queryInScope('br:', chip('all'))).toBe('');
  });

  it('keeps a prefix later in the text, which is text', () => {
    expect(queryInScope('fix br:main', chip('changesets'))).toBe('cs:fix br:main');
  });
});

describe('steppedChip', () => {
  it('moves through the row then More', () => {
    const chips = workspaceChips();
    expect(steppedChip(chips, 'all', 1).scope).toBe('branches');
    expect(steppedChip(chips, 'commands', 1).scope).toBe('labels');
    expect(steppedChip(chips, 'labels', -1).scope).toBe('commands');
  });

  it('goes round at either end', () => {
    const chips = workspaceChips();
    expect(steppedChip(chips, 'people', 1).scope).toBe('all');
    expect(steppedChip(chips, 'all', -1).scope).toBe('people');
  });

  it('starts from All when a typed prefix has no chip here (files, outside a workspace)', () => {
    const chips = scopeChipsFor(repositoryPlace('game@local'))!;
    expect(steppedChip(chips, 'files', 1).scope).toBe('branches');
  });
});

describe('moreChipLabel', () => {
  const { more } = workspaceChips();

  it('says More while the scope has a chip in the row', () => {
    expect(moreChipLabel(more, 'all')).toEqual({ label: 'More', active: false });
    expect(moreChipLabel(more, 'branches')).toEqual({ label: 'More', active: false });
  });

  it('names the section picked under it, highlighted', () => {
    expect(moreChipLabel(more, 'shelves')).toEqual({ label: 'Shelves', active: true });
  });
});
