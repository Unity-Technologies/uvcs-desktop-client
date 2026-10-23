import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { Branch } from '@shared/domain/branch';
import { MINE } from '../../lib/peopleFilter';
import { rememberedFilters } from '../../lib/viewFilters';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { branchMenu } from '../branches/branchMenu';
import { graphMenu } from '../branchExplorer/graphMenu';
import { sampleHistory } from '../branchExplorer/model/graphFixtures';
import { layoutGraph } from '../branchExplorer/model/layoutGraph';
import { CHANGESET_SESSION_FILTERS, CURRENT_BRANCH, pickedBranchFilters } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';
import { showBranchChangesets } from './showBranchChangesets';

const WORKSPACE = '/ws';
const NESTED = '/main/características-del-niño/日本語のブランチ名-テスト';

function filtersShown() {
  const { text, people, since, onlyCurrentBranch, pickedBranch } = useChangesetFilters.getState();
  return { text, people, since, onlyCurrentBranch, pickedBranch };
}

describe('Show changesets', () => {
  // One rule for both ways to pick a branch: its history shows, and what the view remembers stays as it was.
  it('leaves what the view remembers as it was, from the menu and from the branch chip alike', () => {
    const store = useChangesetFilters;
    store.getState().update({ text: 'fix', people: MINE, since: 'lastWeek', ...CURRENT_BRANCH });
    const remembered = () => rememberedFilters(store.getState(), CHANGESET_SESSION_FILTERS);
    const before = remembered();

    showBranchChangesets(WORKSPACE, NESTED);
    expect(remembered()).toEqual(before);
    expect(whereTheWindowIs().view).toBe('changesets');

    store.getState().update(pickedBranchFilters(WORKSPACE, '/main/task'));
    expect(remembered()).toEqual(before);
  });

  it("is in a branch's menu, in the Branches view and the Branch Explorer alike", () => {
    const branch: Branch = { id: 7, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '2026-09-01T00:00:00Z', headChangeset: 5, guid: 'g', repository: 'game@local' };
    const entryOf = (menu: ReturnType<typeof branchMenu>) => menu.find((entry) => typeof entry === 'object' && 'id' in entry && entry.id === 'changesets');

    const fromList = entryOf(branchMenu(workspacePlace(WORKSPACE), [branch], '/main'));
    expect(fromList).toMatchObject({ label: 'Show changesets' });
    (fromList as { run: () => void }).run();
    expect(filtersShown().pickedBranch).toMatchObject({ workspacePath: WORKSPACE, name: '/main/task' });

    const layout = layoutGraph(sampleHistory());
    const context = { workspacePath: WORKSPACE, layout, currentBranch: '/main', loadedChangeset: 6, repository: 'game@local', goToChangeset: () => {}, showRelatedTo: () => {}, revealCreatedBranch: () => {} };
    const fromGraph = entryOf(graphMenu({ kind: 'branch', lane: layout.lanesByBranch.get('/main/a')! }, context));
    (fromGraph as { run: () => void }).run();
    expect(filtersShown().pickedBranch).toMatchObject({ workspacePath: WORKSPACE, name: '/main/a' });
    expect(whereTheWindowIs().view).toBe('changesets');
  });

  it('is offered for one branch at a time', () => {
    const branch: Branch = { id: 7, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '', headChangeset: 5, guid: 'g', repository: 'game@local' };
    const ids = branchMenu(workspacePlace(WORKSPACE), [branch, { ...branch, id: 8, name: '/main/other' }], '/main').map((entry) => typeof entry === 'object' && 'id' in entry && entry.id);
    expect(ids).not.toContain('changesets');
  });
});
