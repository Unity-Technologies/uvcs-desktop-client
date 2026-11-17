import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { offersMerges, offersServerMerges } from './mergesOffered';

const workspace = workspacePlace(join(tmpdir(), 'game'));

describe('offersMerges', () => {
  it('offers merges in a standard or a dynamic workspace', () => {
    expect(offersMerges({ place: workspace, workspaceKind: 'standard' })).toBe(true);
    expect(offersMerges({ place: workspace, workspaceKind: 'dynamic' })).toBe(true);
  });

  it('offers none into a partial workspace', () => {
    expect(offersMerges({ place: workspace, workspaceKind: 'partial' })).toBe(false);
  });

  it('offers merges while the kind is unknown, as most workspaces are standard', () => {
    expect(offersMerges({ place: workspace, workspaceKind: undefined })).toBe(true);
  });

  it('offers none in a repository explored without a workspace', () => {
    expect(offersMerges({ place: repositoryPlace('game@local'), workspaceKind: undefined })).toBe(false);
  });
});

describe('offersServerMerges', () => {
  it('offers merges on the server in every kind of workspace, a partial one too', () => {
    for (const workspaceKind of ['standard', 'dynamic', 'partial', undefined] as const) {
      expect(offersServerMerges({ place: workspace, workspaceKind })).toBe(true);
    }
  });

  it('offers none in a repository explored without a workspace, as the merge page runs in one', () => {
    expect(offersServerMerges({ place: repositoryPlace('game@local'), workspaceKind: undefined })).toBe(false);
  });
});
