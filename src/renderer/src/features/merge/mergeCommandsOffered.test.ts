import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { workspacePlace } from '@shared/domain/place';
import { mergeCommandsOffered } from './mergeCommandsOffered';

const place = workspacePlace(join(tmpdir(), 'game'));

describe('mergeCommandsOffered', () => {
  it('offers every merge, and applying a shelve, in a standard workspace, in the order the palette always showed them', () => {
    expect(mergeCommandsOffered({ place, workspaceKind: 'standard' })).toEqual(['merge.fromBranch', 'merge.toBranch', 'merge.cherryPick', 'merge.applyShelve', 'merge.subtractive']);
  });

  it('offers in a partial workspace the merge on the server and applying a shelve, no merge into the workspace', () => {
    expect(mergeCommandsOffered({ place, workspaceKind: 'partial' })).toEqual(['merge.toBranch', 'merge.applyShelve']);
  });
});
