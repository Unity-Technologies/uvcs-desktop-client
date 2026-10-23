import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { sidebarGroups } from './sidebarGroups';

const shown = (place: Parameters<typeof sidebarGroups>[0]) => sidebarGroups(place).map(({ label, views }) => [label, views.map((view) => view.id)]);

describe('sidebarGroups', () => {
  it("groups a workspace's views as the sidebar shows them", () => {
    expect(shown(workspacePlace('/wk')).map(([group]) => group)).toEqual(['Workspace', 'History', 'Collaborate']);
  });

  it('groups Files alone as the Repository of a repository explored without a workspace', () => {
    expect(shown(repositoryPlace('game@local'))).toEqual([
      ['Repository', ['files']],
      ['History', ['branchExplorer', 'changesets', 'branches', 'labels', 'shelves', 'attributes']],
      ['Collaborate', ['codeReviews', 'locks']],
    ]);
  });
});
