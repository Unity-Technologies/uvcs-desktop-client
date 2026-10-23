import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { sidebarGroups } from './sidebarGroups';
import { viewsOf } from './viewRegistry';

const shown = (place: Parameters<typeof viewsOf>[0]) => sidebarGroups(viewsOf(place)).map(({ group, views }) => [group, views.map((view) => view.id)]);

describe('sidebarGroups', () => {
  it("groups a workspace's views as the sidebar shows them", () => {
    expect(shown(workspacePlace('/wk')).map(([group]) => group)).toEqual(['Workspace', 'History', 'Collaborate']);
  });

  it('leaves out the Workspace group of a repository explored without one, its views emptied', () => {
    expect(shown(repositoryPlace('game@local'))).toEqual([
      ['History', ['branchExplorer', 'changesets', 'branches', 'labels', 'shelves', 'attributes']],
      ['Collaborate', ['codeReviews', 'locks']],
    ]);
  });
});
