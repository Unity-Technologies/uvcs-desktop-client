import { describe, expect, it } from 'vitest';
import { openingStep, positionLabel } from '../diff/viewer/changeNavigation';
import { fileSteps, pendingArrival } from '../diff/viewer/fileSteps';
import { pressStep } from '../diff/viewer/stepNavigation';

/**
 * Moving through Incoming's files as `IncomingSession` does: a file's diff steps through its changes beside the list's
 * files (`fileSteps`), a conflicting file through its conflicts beside the files that wait (`conflictSteps`), and both
 * share one pending arrival, so ↓ past a diff's last change lands on the conflicting file's first conflict, and nothing
 * stale is left for a file opened later.
 */
class IncomingList {
  private shown = '';
  private current: number | null = null;
  private readonly pending = pendingArrival();

  /** `files`: each file of the list, how many changes or conflicts it has, and whether it conflicts. */
  constructor(private readonly files: Record<string, { steps: number; conflicts?: true }>) {
    this.open(Object.keys(files)[0]!);
  }

  get header(): string {
    const label = positionLabel({ count: this.count, current: this.current });
    return label ? `${this.shown}: ${label}` : this.shown;
  }

  /** Whether an arrival is still waiting for some file, which a file opened later would take. */
  get staleArrival(): boolean {
    return this.pending.current !== null;
  }

  press(direction: 1 | -1): this {
    const outcome = pressStep({ count: this.count, current: this.current, above: 0 }, direction, this.stepsOfShown(), () => 0);
    if (typeof outcome === 'number') this.current = outcome;
    return this;
  }

  pick(path: string): this {
    this.open(path);
    return this;
  }

  private get count(): number {
    return this.files[this.shown]!.steps;
  }

  /** The steps the file shown goes on to: every file beside a diff, the conflicting files beside a conflict. */
  private stepsOfShown() {
    const conflicting = this.files[this.shown]!.conflicts;
    const keys = Object.keys(this.files).filter((path) => !conflicting || this.files[path]!.conflicts);
    return fileSteps(keys, this.shown, { select: (key) => this.open(key), pathOf: (key) => key }, this.pending);
  }

  private open(path: string): void {
    this.shown = path;
    const arrival = this.stepsOfShown().takeArrival(path);
    const opening = openingStep(arrival, this.count, false);
    this.current = opening?.movesTo ? opening.index : null;
  }
}

describe('stepping through Incoming', () => {
  const incoming = () => new IncomingList({ 'a.cs': { steps: 2 }, 'b.cs': { steps: 2, conflicts: true }, 'c.cs': { steps: 1 } });

  it("goes on past a diff's last change to the conflicting file's first conflict", () => {
    const list = incoming();
    expect([list.press(1).header, list.press(1).header, list.press(1).header]).toEqual(['a.cs: 1 of 2', 'a.cs: 2 of 2', 'b.cs: 1 of 2']);
  });

  it('leaves no arrival behind for a file opened later', () => {
    const list = incoming().press(1).press(1).press(1);
    expect(list.staleArrival).toBe(false);
    expect(list.pick('c.cs').header).toBe('c.cs');
  });

  it("comes back up from a conflict to the diff's last change", () => {
    const list = incoming().pick('c.cs');
    expect(list.press(-1).header).toBe('b.cs: 2 of 2');
  });
});
