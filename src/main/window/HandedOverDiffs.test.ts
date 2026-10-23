import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { HandedOverDiffs } from './HandedOverDiffs';

const GAME = workspacePlace(join('/work', 'game'));
const TOOLS = workspacePlace(join('/work', 'tools'));
const PLAYER: DiffEntry = { status: 'changed', path: 'src/player.cs', itemType: 'file', baseRevisionId: 13, revisionId: 37, repository: 'game@local' };

describe('HandedOverDiffs', () => {
  it('gives the diff handed over once, to the first read of the same target in the same workspace', () => {
    const diffs = new HandedOverDiffs();
    diffs.hand(GAME, { kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:2' }, [PLAYER]);

    expect(diffs.take(TOOLS, { kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:2' })).toBeUndefined();
    expect(diffs.take(GAME, { kind: 'range', fromSpec: 'cs:2', toSpec: 'cs:1' })).toBeUndefined();
    expect(diffs.take(GAME, { kind: 'range', toSpec: 'cs:2', fromSpec: 'cs:1' })).toEqual([PLAYER]);
    expect(diffs.take(GAME, { kind: 'range', fromSpec: 'cs:1', toSpec: 'cs:2' })).toBeUndefined();
  });

  it('keeps only the last few nobody took, so a page window that never loaded holds nothing for long', () => {
    const diffs = new HandedOverDiffs();
    for (let id = 1; id <= 5; id++) diffs.hand(GAME, { kind: 'changeset', changesetId: id }, [PLAYER]);

    expect(diffs.take(GAME, { kind: 'changeset', changesetId: 1 })).toBeUndefined();
    expect(diffs.take(GAME, { kind: 'changeset', changesetId: 2 })).toEqual([PLAYER]);
    expect(diffs.take(GAME, { kind: 'changeset', changesetId: 5 })).toEqual([PLAYER]);
  });

  it('keeps a repository with no workspace apart from a workspace on it', () => {
    const diffs = new HandedOverDiffs();
    diffs.hand(repositoryPlace('game@local'), { kind: 'changeset', changesetId: 1 }, [PLAYER]);

    expect(diffs.take(GAME, { kind: 'changeset', changesetId: 1 })).toBeUndefined();
    expect(diffs.take(repositoryPlace('game@local'), { kind: 'changeset', changesetId: 1 })).toEqual([PLAYER]);
  });
});
