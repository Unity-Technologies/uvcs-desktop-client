import { describe, expect, it } from 'vitest';
import { arrivalChange, currentAfterChange, plannedMove, positionLabel } from '../diff/viewer/changeNavigation';
import { fileSteps, type PendingArrival } from '../diff/viewer/fileSteps';
import { conflictStepKeys } from './conflictSteps';

/**
 * Stepping through the conflicts of the merge page (⌥↓ ⌥↑, F7 ⇧F7, the arrows around "2 of 3"), as `ConflictNavigator`
 * does with the list's `FileStepsContext` (`conflictStepKeys`): past a file's last conflict on to the first of the next
 * file still waiting for the user, past its first back to the last of the previous one; files decided or merged
 * automatically are passed by. Resolving a conflict takes it out of the file, and the next move goes on from there.
 */

interface ListedFile {
  /** The conflicts left in its text; a binary waiting for a version to keep counts as one. */
  conflicts: number;
  /** Decided by the user, or merged automatically. */
  decided?: boolean;
}

class MergePage {
  private shown = '';
  private current: number | null = null;
  /** How many conflicts start above the top of the view: where the first move goes from. */
  private above = 0;
  private readonly pending: { current: PendingArrival | null } = { current: null };

  constructor(private readonly files: Record<string, ListedFile>) {
    this.open(Object.keys(files)[0]!);
  }

  /** The file shown and the arrows' "2 of 3". */
  get header(): string {
    return `${this.shown}: ${positionLabel({ count: this.count, current: this.current }, 'conflict')}`;
  }

  press(direction: 1 | -1): this {
    const steps = this.steps();
    const move = plannedMove({ count: this.count, current: this.current, above: this.above }, direction, steps.canStep(direction));
    if (move?.to === 'change') this.current = move.index;
    else if (move?.to === 'file') steps.step(direction);
    return this;
  }

  goesTo(direction: 1 | -1): string | null {
    return plannedMove({ count: this.count, current: this.current, above: this.above }, direction, this.steps().canStep(direction))?.to ?? null;
  }

  /** Keeps a side of the conflict moved to: it leaves the text, which stays where it was in the view. */
  resolveCurrent(): this {
    const file = this.files[this.shown]!;
    const before = Array.from({ length: file.conflicts });
    file.conflicts -= 1;
    if (file.conflicts === 0) file.decided = true;
    this.above = this.current ?? this.above;
    this.current = currentAfterChange(this.current, before, Array.from({ length: file.conflicts }));
    return this;
  }

  /** Clicks a file in the list. */
  select(path: string): this {
    this.open(path);
    return this;
  }

  private get count(): number {
    return this.files[this.shown]!.conflicts;
  }

  private steps() {
    const rows = Object.keys(this.files).map((path) => ({ type: 'file', key: path, item: path }));
    const keys = conflictStepKeys(rows, this.shown, (path) => !this.files[path]!.decided);
    return fileSteps(keys, this.shown, { select: (key) => this.open(key), pathOf: (key) => key }, this.pending);
  }

  private open(path: string): void {
    this.shown = path;
    this.above = 0;
    const arrival = this.steps().takeArrival(path);
    this.current = arrival ? arrivalChange(arrival, this.count) : null;
  }
}

describe('stepping through the conflicts of a merge', () => {
  const merge = () =>
    new MergePage({
      'Enemy.cs': { conflicts: 1 },
      'Level.cs': { conflicts: 3 },
      'Menu.cs': { conflicts: 0, decided: true },
      'logo.png': { conflicts: 1 },
      'Player.cs': { conflicts: 2 },
    });

  it("goes through a file's conflicts, then on to the next file's first, passing by the files decided", () => {
    const page = merge();
    const headers = [page.header];
    for (let press = 0; press < 8; press++) headers.push(page.press(1).header);
    expect(headers).toEqual([
      'Enemy.cs: 1 conflict',
      'Enemy.cs: 1 of 1',
      'Level.cs: 1 of 3',
      'Level.cs: 2 of 3',
      'Level.cs: 3 of 3',
      'logo.png: 1 of 1',
      'Player.cs: 1 of 2',
      'Player.cs: 2 of 2',
      'Player.cs: 2 of 2',
    ]);
    expect(page.goesTo(1)).toBeNull();
  });

  it("goes back to the previous waiting file's last conflict past the first", () => {
    const page = merge().select('Player.cs').press(1);
    expect([page.press(-1).header, page.press(-1).header, page.press(-1).header]).toEqual(['logo.png: 1 of 1', 'Level.cs: 3 of 3', 'Level.cs: 2 of 3']);
  });

  it('goes on from the conflict resolved to the one that followed it, or to the next file past the last', () => {
    const page = merge().select('Level.cs').press(1).press(1);
    expect(page.header).toBe('Level.cs: 2 of 3');
    expect(page.resolveCurrent().header).toBe('Level.cs: 2 conflicts');
    expect(page.press(1).header).toBe('Level.cs: 2 of 2');
    expect(page.resolveCurrent().press(1).header).toBe('logo.png: 1 of 1');
  });

  it('goes back up to a conflict left above the one resolved', () => {
    const page = merge().select('Level.cs').press(1).press(1);
    expect(page.resolveCurrent().press(-1).header).toBe('Level.cs: 1 of 2');
    expect(page.resolveCurrent().header).toBe('Level.cs: 1 conflict');
  });

  it('keeps its place in the list from a file just decided, which it no longer goes back to', () => {
    const page = merge().select('Level.cs');
    for (let conflict = 0; conflict < 3; conflict++) page.press(1).resolveCurrent();
    expect(page.header).toBe('Level.cs: No conflicts');
    expect(page.press(-1).header).toBe('Enemy.cs: 1 of 1');
    expect(page.press(1).header).toBe('logo.png: 1 of 1');
  });

  it('steps from a file decided or merged automatically, opened from the list, to the files around it that wait', () => {
    const page = merge().select('Menu.cs');
    expect(page.header).toBe('Menu.cs: No conflicts');
    expect(page.press(1).header).toBe('logo.png: 1 of 1');
    expect(merge().select('Menu.cs').press(-1).header).toBe('Level.cs: 3 of 3');
  });

  it('stops at the ends once nothing else waits', () => {
    const page = new MergePage({ 'a.cs': { conflicts: 2 }, 'b.cs': { conflicts: 0, decided: true } });
    expect(page.goesTo(-1)).toBeNull();
    page.press(1).press(1);
    expect(page.header).toBe('a.cs: 2 of 2');
    expect(page.goesTo(1)).toBeNull();
  });
});
