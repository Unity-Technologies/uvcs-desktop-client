import { describe, expect, it, vi } from 'vitest';
import '../../testing/fakeWindow';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { answerConfirms, askedDialogs } from '../../testing/fakeDialogs';
import { hotkey } from '../../lib/shortcutRegistry';
import { branchPositionEntries, branchPositionsOf, moveBranch, resetAllPositions, type BranchPositions } from './branchPosition';
import type { BranchPins } from './model/branchRows';
import { branch, changeset } from './model/graphFixtures';
import { layoutGraph } from './model/layoutGraph';

vi.mock('../../ui/dialog/confirm', () => import('../../testing/fakeDialogs'));

/** /main 1 on row 0, /main/a 2 on row 1, /main/c 3 alone on row 2 (it overlaps /main/a). */
function history(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 3), branch('/main/a', '/main', 2), branch('/main/c', '/main', 4)].map((each, index) => ({ ...each, id: index + 1 })),
    changesets: [changeset(0, '/main', -1), changeset(1, '/main', 0), changeset(2, '/main/a', 1), changeset(3, '/main', 1), changeset(4, '/main/c', 1)],
    mergeLinks: [],
    labels: [],
  };
}

function explorer(pins: BranchPins = []) {
  const layout = layoutGraph(history(), undefined, null, pins);
  const saved: BranchPins[] = [];
  const positions: BranchPositions = { pins, setPins: (next) => saved.push(next) };
  const entries = (name: string) => branchPositionEntries(layout, layout.lanesByBranch.get(name)!, positions);
  const enabled = (name: string) => entries(name).filter((entry) => !entry.disabled).map((entry) => entry.id);
  const run = (name: string, id: string) => entries(name).find((entry) => entry.id === id)!.run();
  return { layout, positions, saved, entries, enabled, run };
}

describe('branchPositionEntries', () => {
  it('offers the four moves with their keys, then the resets', () => {
    expect(explorer().entries('/main/a').map(({ id, label, shortcut }) => ({ id, label, shortcut }))).toEqual([
      { id: 'position.up', label: 'Move up', shortcut: hotkey('graphMoveBranchUp') },
      { id: 'position.down', label: 'Move down', shortcut: hotkey('graphMoveBranchDown') },
      { id: 'position.top', label: 'Move to the top', shortcut: hotkey('graphMoveBranchToTop') },
      { id: 'position.bottom', label: 'Move to the bottom', shortcut: hotkey('graphMoveBranchToBottom') },
      { id: 'position.reset', label: 'Reset position', shortcut: undefined },
      { id: 'position.resetAll', label: 'Reset all positions…', shortcut: undefined },
    ]);
  });

  it('offers no move up from the top row, nor down from alone on the last one', () => {
    const { enabled, layout } = explorer();
    expect(layout.lanesByBranch.get('/main/c')!.row).toBe(2);
    expect(enabled('/main')).toEqual(['position.down', 'position.bottom']);
    expect(enabled('/main/a')).toEqual(['position.up', 'position.down', 'position.top', 'position.bottom']);
    expect(enabled('/main/c')).toEqual(['position.up', 'position.top']);
  });

  it("offers resetting a moved branch's position, and every position once one branch moved", () => {
    const { enabled } = explorer([{ branch: 3, row: 1 }]);
    expect(enabled('/main/c')).toContain('position.reset');
    expect(enabled('/main/a')).not.toContain('position.reset');
    expect(enabled('/main/a')).toContain('position.resetAll');
  });

  it('moves the branch by saving its new row', () => {
    const { run, saved } = explorer();
    run('/main/c', 'position.top');
    expect(saved).toEqual([[{ branch: 3, row: 0 }]]);
  });

  it('puts one branch back and keeps the others moved', () => {
    const { run, saved } = explorer([
      { branch: 2, row: 2 },
      { branch: 3, row: 1 },
    ]);
    run('/main/c', 'position.reset');
    expect(saved).toEqual([[{ branch: 2, row: 2 }]]);
  });

  it('asks before putting every branch back', () => {
    const { run } = explorer([{ branch: 3, row: 1 }]);
    run('/main/a', 'position.resetAll');
    expect(askedDialogs()).toEqual([{ kind: 'confirm', title: 'Reset all positions?' }]);
  });
});

describe('branchPositionsOf', () => {
  it('has no positions while the repository is not known, so nothing can be moved and lost', () => {
    expect(branchPositionsOf(undefined, [], () => {})).toBeNull();
  });

  it("saves the moves in the repository's own pins", () => {
    const saved: [string, BranchPins][] = [];
    const pins: BranchPins = [{ branch: 3, row: 1 }];
    const positions = branchPositionsOf('game@local', [], (repository, next) => saved.push([repository, next]))!;
    positions.setPins(pins);
    expect(saved).toEqual([['game@local', pins]]);
  });
});

describe('branchPositionEntries without a repository', () => {
  it('lists every entry, all disabled', () => {
    const layout = layoutGraph(history(), undefined, null, []);
    const entries = branchPositionEntries(layout, layout.lanesByBranch.get('/main/a')!, null);
    expect(entries.map(({ id, disabled }) => ({ id, disabled }))).toEqual(
      ['up', 'down', 'top', 'bottom', 'reset', 'resetAll'].map((move) => ({ id: `position.${move}`, disabled: true })),
    );
  });
});

describe('resetAllPositions', () => {
  it('puts every branch back once the user agrees', async () => {
    const saved: BranchPins[] = [];
    await resetAllPositions((pins) => saved.push(pins));
    expect(saved).toEqual([[]]);
  });

  it('keeps every position when the user declines', async () => {
    answerConfirms(false);
    const saved: BranchPins[] = [];
    await resetAllPositions((pins) => saved.push(pins));
    expect(saved).toEqual([]);
  });
});

describe('moveBranch', () => {
  it('saves nothing for a move the branch has no room for', () => {
    const { layout, positions, saved } = explorer();
    moveBranch(layout, layout.lanesByBranch.get('/main')!, 'up', positions);
    expect(saved).toEqual([]);
  });
});
