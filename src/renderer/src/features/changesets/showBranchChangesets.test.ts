import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { whereTheWindowIs } from '../../testing/operationOutcome';
import { branchMenu } from '../branches/branchMenu';
import { graphMenu } from '../branchExplorer/graphMenu';
import { branch as graphBranch, sampleHistory } from '../branchExplorer/model/graphFixtures';
import { layoutGraph } from '../branchExplorer/model/layoutGraph';
import { CURRENT_BRANCH } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';
import { showBranchChangesets } from './showBranchChangesets';

const WORKSPACE = '/ws';
const NESTED = '/main/características-del-niño/日本語のブランチ名-テスト';

function filtersShown() {
  const { text, people, since, onlyCurrentBranch, pickedBranch } = useChangesetFilters.getState();
  return { text, people, since, onlyCurrentBranch, pickedBranch };
}

describe('Show changesets', () => {
  it("opens Changesets on the branch's changesets, any time, with no text or people hiding some", () => {
    useChangesetFilters.getState().update({ text: 'fix', people: MINE, since: 'lastWeek', ...CURRENT_BRANCH });

    showBranchChangesets(WORKSPACE, NESTED);

    expect(filtersShown()).toEqual({ text: '', people: EVERYONE, since: 'anyTime', onlyCurrentBranch: false, pickedBranch: { workspacePath: WORKSPACE, name: NESTED } });
    expect(whereTheWindowIs().view).toBe('changesets');
  });

  it("is in a branch's menu, in the Branches view and the Branch Explorer alike", () => {
    const branch: Branch = { id: 7, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '2026-09-01T00:00:00Z', headChangeset: 5, guid: 'g', repository: 'game@local' };
    const entryOf = (menu: ReturnType<typeof branchMenu>) => menu.find((entry) => typeof entry === 'object' && 'id' in entry && entry.id === 'changesets');

    const fromList = entryOf(branchMenu(WORKSPACE, [branch], '/main'));
    expect(fromList).toMatchObject({ label: 'Show changesets' });
    (fromList as { run: () => void }).run();
    expect(filtersShown().pickedBranch).toEqual({ workspacePath: WORKSPACE, name: '/main/task' });

    const layout = layoutGraph({ ...sampleHistory(), branches: [...sampleHistory().branches, graphBranch('/main/task', '/main', 5)] });
    const context = { workspacePath: WORKSPACE, layout, currentBranch: '/main', loadedChangeset: 6, repository: 'game@local', goToChangeset: () => {}, showRelatedTo: () => {}, revealCreatedBranch: () => {} };
    const fromGraph = entryOf(graphMenu({ kind: 'branch', lane: layout.lanesByBranch.get('/main/a')! }, context));
    (fromGraph as { run: () => void }).run();
    expect(filtersShown().pickedBranch).toEqual({ workspacePath: WORKSPACE, name: '/main/a' });
    expect(whereTheWindowIs().view).toBe('changesets');
  });

  it('is offered for one branch at a time', () => {
    const branch: Branch = { id: 7, name: '/main/task', parent: '/main', comment: '', owner: 'ana', date: '', headChangeset: 5, guid: 'g', repository: 'game@local' };
    const ids = branchMenu(WORKSPACE, [branch, { ...branch, id: 8, name: '/main/other' }], '/main').map((entry) => typeof entry === 'object' && 'id' in entry && entry.id);
    expect(ids).not.toContain('changesets');
  });
});
