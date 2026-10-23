import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { firstViewOf, showsPage, showsView, VIEW_IDS } from './views';

const inWorkspace = workspacePlace('/wk/game');
const inRepository = repositoryPlace('game@local');

describe('the views of a place', () => {
  it('are every view in a workspace', () => {
    expect(VIEW_IDS.filter((view) => showsView(inWorkspace, view))).toEqual([...VIEW_IDS]);
  });

  it("are the server's in a repository explored without a workspace: none of a workspace's own", () => {
    expect(VIEW_IDS.filter((view) => !showsView(inRepository, view))).toEqual(['changes', 'incoming', 'files', 'sync']);
  });

  it("open on a workspace's changes, and on a repository's Branch Explorer, which it shows", () => {
    expect(firstViewOf(inWorkspace)).toBe('changes');
    expect(firstViewOf(inRepository)).toBe('branchExplorer');
    expect(showsView(inRepository, firstViewOf(inRepository))).toBe(true);
  });
});

describe('the pages of a place', () => {
  it("are every page but the merge page in a repository explored without a workspace", () => {
    expect(showsPage(inRepository, { kind: 'diff' })).toBe(true);
    expect(showsPage(inRepository, { kind: 'history' })).toBe(true);
    expect(showsPage(inRepository, { kind: 'merge' })).toBe(false);
    expect(showsPage(inWorkspace, { kind: 'merge' })).toBe(true);
  });
});
