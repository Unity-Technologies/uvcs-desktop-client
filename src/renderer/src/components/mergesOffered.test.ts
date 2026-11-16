import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { offersMerges } from './mergesOffered';

const workspace = workspacePlace(join(tmpdir(), 'game'));

describe('offersMerges', () => {
  it('offers merges in a standard or a dynamic workspace', () => {
    expect(offersMerges({ place: workspace, workspaceKind: 'standard' })).toBe(true);
    expect(offersMerges({ place: workspace, workspaceKind: 'dynamic' })).toBe(true);
  });

  it('offers none in a partial workspace, not even on the server', () => {
    expect(offersMerges({ place: workspace, workspaceKind: 'partial' })).toBe(false);
  });

  it('offers merges while the kind is unknown, as most workspaces are standard', () => {
    expect(offersMerges({ place: workspace, workspaceKind: undefined })).toBe(true);
  });

  it('offers none in a repository explored without a workspace', () => {
    expect(offersMerges({ place: repositoryPlace('game@local'), workspaceKind: undefined })).toBe(false);
  });
});
