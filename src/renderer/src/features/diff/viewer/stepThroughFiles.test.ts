import { describe, expect, it } from 'vitest';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { arrivalChange, changePositionLabel, plannedMove } from './changeNavigation';
import { DIFF_TEST_TEXTS } from './diffTestTexts';
import { fileSteps, type PendingArrival } from './fileSteps';
import { lineDiff } from './lineDiff';

/**
 * Moving through changes (⌥↓ ⌥↑, F7 ⇧F7) in a diff beside a list of files, as `useChangeNavigation` does with the
 * list's `FileStepsContext`: past the last change on to the next file's first, past the first back to the previous
 * file's last, and through files with nothing to step through. The view stays at the top of each file it opens.
 */

const changesOf = (original: string, modified: string): number => listChangeRegions(listChangeBlocks(lineDiff(original, modified, 'recognizeAll').meta)).length;

class DiffBesideList {
  private shown = '';
  private current: number | null = null;
  private readonly pending: { current: PendingArrival | null } = { current: null };

  /** `files`: each file of the list and how many changes its diff has. */
  constructor(private readonly files: Record<string, number>) {
    this.open(Object.keys(files)[0]!);
  }

  /** The list's current file and the header's "3 of 12". */
  get header(): string {
    return `${this.shown}: ${changePositionLabel({ count: this.count, current: this.current })}`;
  }

  press(direction: 1 | -1): this {
    const steps = this.steps();
    const move = plannedMove({ count: this.count, current: this.current, above: 0 }, direction, steps.canStep(direction));
    if (move?.to === 'change') this.current = move.index;
    else if (move?.to === 'file') steps.step(direction);
    return this;
  }

  goesTo(direction: 1 | -1): string | null {
    return plannedMove({ count: this.count, current: this.current, above: 0 }, direction, this.steps().canStep(direction))?.to ?? null;
  }

  private get count(): number {
    return this.files[this.shown]!;
  }

  private steps() {
    return fileSteps(Object.keys(this.files), this.shown, { select: (key) => this.open(key), pathOf: (key) => key }, this.pending);
  }

  private open(path: string): void {
    this.shown = path;
    const arrival = this.steps().takeArrival(path);
    this.current = arrival ? arrivalChange(arrival, this.count) : null;
  }
}

const [original, modified] = DIFF_TEST_TEXTS['LF'];
const [crlfOriginal, crlfModified] = DIFF_TEST_TEXTS['CRLF'];

describe('stepping through the changes of a list of files', () => {
  const files = () =>
    new DiffBesideList({
      'a.ts': changesOf(original, modified),
      'logo.png': 0,
      'added.ts': changesOf('', 'new\nfile\n'),
      'b.cs': changesOf(crlfOriginal, crlfModified),
    });

  it('counts the changes of a file before the first move', () => {
    expect(files().header).toBe('a.ts: 3 changes');
  });

  it("goes through a file's changes, then on to the next file's first change, stepping past files with none", () => {
    const list = files();
    const headers = [list.header];
    for (let press = 0; press < 9; press++) headers.push(list.press(1).header);
    expect(headers).toEqual([
      'a.ts: 3 changes',
      'a.ts: 1 of 3',
      'a.ts: 2 of 3',
      'a.ts: 3 of 3',
      'logo.png: No changes',
      'added.ts: 1 of 1',
      'b.cs: 1 of 3',
      'b.cs: 2 of 3',
      'b.cs: 3 of 3',
      'b.cs: 3 of 3',
    ]);
  });

  it("goes back to the previous file's last change past the first", () => {
    const list = files();
    for (let press = 0; press < 6; press++) list.press(1);
    expect(list.header).toBe('b.cs: 1 of 3');
    expect([list.press(-1).header, list.press(-1).header, list.press(-1).header]).toEqual(['added.ts: 1 of 1', 'logo.png: No changes', 'a.ts: 3 of 3']);
  });

  it('stops at the last change of the last file and the first of the first', () => {
    const list = files();
    expect(list.goesTo(-1)).toBeNull();
    for (let press = 0; press < 8; press++) list.press(1);
    expect(list.header).toBe('b.cs: 3 of 3');
    expect(list.goesTo(1)).toBeNull();
    expect(list.goesTo(-1)).toBe('change');
  });

  it('keeps going on from a file without changes, whichever way', () => {
    const list = new DiffBesideList({ 'a.png': 0, 'same.txt': changesOf('same\n', 'same\n'), 'b.ts': 1 });
    expect(list.header).toBe('a.png: No changes');
    expect(list.goesTo(1)).toBe('file');
    expect(list.press(1).header).toBe('same.txt: No changes');
    expect(list.goesTo(-1)).toBe('file');
    expect(list.press(1).header).toBe('b.ts: 1 of 1');
  });
});

describe('a diff alone', () => {
  it('stops at its ends, with nowhere else to go', () => {
    const diff = new DiffBesideList({ 'a.ts': changesOf(original, modified) });
    expect([diff.press(1).header, diff.press(1).header, diff.press(1).header, diff.press(1).header]).toEqual(['a.ts: 1 of 3', 'a.ts: 2 of 3', 'a.ts: 3 of 3', 'a.ts: 3 of 3']);
    expect(diff.goesTo(1)).toBeNull();
  });

  it('shows a version alone as one change', () => {
    expect(new DiffBesideList({ 'deleted.ts': changesOf('a\nb\n', '') }).press(1).header).toBe('deleted.ts: 1 of 1');
  });
});
