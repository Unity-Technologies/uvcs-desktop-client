import { describe, expect, it } from 'vitest';
import { arrivalChange, plannedMove, positionLabel, type ChangePosition } from '../diff/viewer/changeNavigation';
import { fileSteps, type PendingArrival } from '../diff/viewer/fileSteps';
import { positionAfterChange, pressStep } from '../diff/viewer/stepNavigation';
import { conflictStepKeys } from './conflictSteps';
import { ConflictPlace } from './resolve/conflictRows';

/**
 * Stepping through the conflicts of the merge page (⌥↓ ⌥↑, F7 ⇧F7, the arrows around "2 of 3"), with the decisions
 * `ConflictNavigator` takes (`pressStep`, `positionAfterChange`, `ConflictPlace`) and the list's `FileStepsContext`
 * (`conflictStepKeys`): past a file's last conflict on to the first of the next file still waiting for the user, past
 * its first back to the last of the previous one; files decided or merged automatically are passed by. Resolving a
 * conflict takes it out of the file, and the next move goes on to the one that took its place. The files are short:
 * every conflict is in view, none starts above its top.
 */

interface ListedFile {
  /** The conflicts left in its text; a binary waiting for a version to keep counts as one. */
  conflicts: number;
  /** Decided by the user, or merged automatically. */
  decided?: boolean;
}

/** No conflict starts above the top of the view: every one is in it. */
const ALL_IN_VIEW = (): number => 0;
/** The view never scrolls: the file is short. */
const UNSCROLLED = { top: 0, max: 0 };

class MergePage {
  private shown = '';
  private position: ChangePosition = { count: 0, current: null, above: 0 };
  private place = new ConflictPlace();
  private readonly pending: { current: PendingArrival | null } = { current: null };

  constructor(private readonly files: Record<string, ListedFile>) {
    this.open(Object.keys(files)[0]!);
  }

  /** The file shown and the arrows' "2 of 3". */
  get header(): string {
    return `${this.shown}: ${positionLabel(this.position, 'conflict')}`;
  }

  press(direction: 1 | -1): this {
    const outcome = pressStep(this.position, direction, this.steps(), () => this.place.above(ALL_IN_VIEW, UNSCROLLED));
    if (typeof outcome === 'number') {
      this.position = { ...this.position, current: outcome };
      this.place.moved();
    }
    return this;
  }

  goesTo(direction: 1 | -1): string | null {
    return plannedMove(this.position, direction, this.steps().canStep(direction))?.to ?? null;
  }

  /** Keeps a side of the conflict at `index`, with its header's choices: it leaves the text. */
  resolve(index: number): this {
    const file = this.files[this.shown]!;
    const before = Array.from({ length: file.conflicts });
    file.conflicts -= 1;
    if (file.conflicts === 0) file.decided = true;
    this.place.resolvedAt(index, before.length, UNSCROLLED);
    this.position = positionAfterChange(this.position, before, Array.from({ length: file.conflicts }), this.place.aboveAfterChange(file.conflicts));
    return this;
  }

  /** Keeps a side of the conflict moved to. */
  resolveCurrent(): this {
    return this.resolve(this.position.current!);
  }

  /** Clicks a file in the list. */
  select(path: string): this {
    this.open(path);
    return this;
  }

  private steps() {
    const rows = Object.keys(this.files).map((path) => ({ type: 'file', key: path, item: path }));
    const keys = conflictStepKeys(rows, this.shown, (path) => !this.files[path]!.decided);
    return fileSteps(keys, this.shown, { select: (key) => this.open(key), pathOf: (key) => key }, this.pending);
  }

  private open(path: string): void {
    this.shown = path;
    this.place = new ConflictPlace();
    const count = this.files[path]!.conflicts;
    const arrival = this.steps().takeArrival(path);
    this.position = { count, current: arrival ? arrivalChange(arrival, count) : null, above: 0 };
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

  it('goes on from the conflict resolved to the one that took its place, not back to the first in view', () => {
    const page = merge().select('Level.cs').press(1).press(1);
    expect(page.header).toBe('Level.cs: 2 of 3');
    expect(page.resolveCurrent().header).toBe('Level.cs: 2 conflicts');
    expect(page.press(1).header).toBe('Level.cs: 2 of 2');
    expect(page.resolveCurrent().press(1).header).toBe('logo.png: 1 of 1');
  });

  it('goes back up to the conflict before the one resolved', () => {
    const page = merge().select('Level.cs').press(1).press(1);
    expect(page.resolveCurrent().press(-1).header).toBe('Level.cs: 1 of 2');
  });

  it('goes on from a conflict resolved without moving to it first', () => {
    const page = merge().select('Level.cs');
    expect(page.resolve(1).press(1).header).toBe('Level.cs: 2 of 2');
  });

  it("goes straight on to the files around it once the file shown is decided, which it doesn't go back to", () => {
    const page = merge().select('Level.cs');
    for (let conflict = 0; conflict < 3; conflict++) page.press(1).resolveCurrent();
    expect(page.header).toBe('Level.cs: No conflicts');
    expect(page.goesTo(1)).toBe('file');
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
