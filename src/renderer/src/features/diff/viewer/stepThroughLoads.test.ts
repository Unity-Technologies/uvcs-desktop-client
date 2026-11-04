import { describe, expect, it } from 'vitest';
import { openingStep, positionLabel } from './changeNavigation';
import { headerArrows } from './diffFrameHost';
import { fileSteps, type PendingArrival } from './fileSteps';
import { pressStep } from './stepNavigation';
import { pressTarget, StepQueue } from './stepQueue';
import type { StepNavigation } from './useStepNavigation';

/** Stands for a published navigation: `headerArrows` only asks whose it is. */
const NAVIGATION = { noun: 'change' } as StepNavigation;

/**
 * Clicking ↓ through a list of files while their diffs catch up, as `SteppedDiffFrame` and `LoadedFileDiff` do. The
 * timeline is the real one: a step selects the next file in the list at once, the diff pane asks for it once the
 * selection settles, its versions arrive (from the cache, in the very render that asks), its diff mounts while the
 * previous one's navigation is still the one published (publishing follows the render), then it publishes, then opens
 * at its arrival. Presses made before that wait in the frame's queue (`StepQueue`), tagged with the file they're for
 * (`pressTarget`, `headerArrows`), and the file's diff takes them once it opened, through its own navigation.
 */
class LoadingDiffs {
  /** The file selected in the list, which a step moves at once. */
  private listCurrent = '';
  /** The file the diff pane asks for, once the list's selection settled. */
  private requested = '';
  /** The diff drawn: whose, where it stands, whether it opened at its arrival. */
  private body: { path: string; current: number | null; opened: boolean } | null = null;
  private published: string | null = null;
  private hasData = false;
  private isPlaceholderData = false;
  private error = false;
  private readonly queue = new StepQueue();
  private readonly pending: { current: PendingArrival | null } = { current: null };

  constructor(private readonly files: Record<string, number>) {
    this.pick(Object.keys(files)[0]!).settle().load().publish().open();
  }

  /** The file selected, and "3 of 12" while its own diff stands on a change. */
  get header(): string {
    const own = this.body?.path === this.listCurrent ? this.body : null;
    const label = own ? positionLabel({ count: this.files[own.path]!, current: own.current }) : '';
    return label ? `${this.listCurrent}: ${label}` : this.listCurrent;
  }

  /** ↓ (1) or ↑ (-1) on the header's arrows, as the arrows shown take it. */
  press(direction: 1 | -1): this {
    const arrows = headerArrows({
      published: this.published === null ? null : { navigation: NAVIGATION, stepsOwn: true, key: this.published },
      requestedKey: this.requested,
      error: this.error,
      hasData: this.hasData,
      isPlaceholderData: this.isPlaceholderData,
    });
    if (arrows.body) this.bodyGo(direction);
    else if (arrows.queues) this.queue.push(this.steps().steppingTo() ?? this.requested, direction);
    else this.steps().step(direction);
    return this;
  }

  /** A file picked in the list. */
  pick(path: string): this {
    this.listCurrent = path;
    return this;
  }

  /** The list's selection settled: the diff pane asks for it, the previous diff on screen while it's read. */
  settle(): this {
    this.requested = this.listCurrent;
    this.isPlaceholderData = this.hasData;
    this.error = false;
    return this;
  }

  /** Its versions arrive: its diff mounts, the previous one's navigation still published. */
  load(): this {
    this.hasData = true;
    this.isPlaceholderData = false;
    this.body = { path: this.requested, current: null, opened: false };
    return this;
  }

  /** The new diff publishes its navigation (a layout effect, after the render that mounted it). */
  publish(): this {
    this.published = this.body!.path;
    return this;
  }

  /** The new diff opens at its arrival, then takes the presses kept for it. */
  open(): this {
    const body = this.body!;
    const opening = openingStep(this.steps().takeArrival(body.path), this.files[body.path]!, false);
    body.current = opening?.movesTo ? opening.index : null;
    body.opened = true;
    for (let kept = this.queue.take(body.path); kept !== undefined; kept = this.queue.take(body.path)) this.bodyGo(kept);
    return this;
  }

  /** The requested file couldn't be read. */
  fail(): this {
    this.error = true;
    this.body = null;
    this.published = null;
    return this;
  }

  /** The diff's own go: kept for the file it's for, else a step (on to the next file past its last change). */
  private bodyGo(direction: 1 | -1): void {
    const body = this.body!;
    const target = pressTarget({ opens: true, opened: body.opened, steppingTo: this.steps().steppingTo(), path: body.path });
    if (target.kind === 'keep') return this.queue.push(target.path, direction);
    const outcome = pressStep({ count: this.files[body.path]!, current: body.current, above: 0 }, direction, this.steps(), () => 0);
    if (typeof outcome === 'number') body.current = outcome;
  }

  private steps() {
    return fileSteps(Object.keys(this.files), this.listCurrent, { select: (key) => this.pick(key), pathOf: (key) => key }, this.pending);
  }
}

const atLastChangeOfA = () => new LoadingDiffs({ 'a.cs': 3, 'b.cs': 3, 'c.cs': 2 }).press(1).press(1).press(1);

describe('clicking ↓ while the next diff catches up', () => {
  it("keeps a press made while the previous file's diff still shows, the list already on the next file", () => {
    const list = atLastChangeOfA();
    expect(list.header).toBe('a.cs: 3 of 3');
    expect(list.press(1).press(1).settle().load().publish().open().header).toBe('b.cs: 2 of 3');
  });

  it("keeps one made once the next file's diff mounted, the previous one's navigation still published", () => {
    expect(atLastChangeOfA().press(1).settle().load().press(1).publish().open().header).toBe('b.cs: 2 of 3');
  });

  it('keeps one made after the new diff published but before it opened at its arrival', () => {
    expect(atLastChangeOfA().press(1).settle().load().publish().press(1).open().header).toBe('b.cs: 2 of 3');
  });

  it('applies each press once, none lost nor doubled: ↓↓↓ ends on the 3rd change', () => {
    expect(atLastChangeOfA().press(1).press(1).press(1).settle().load().publish().open().header).toBe('b.cs: 3 of 3');
  });

  it('drops the presses meant for a file once another is picked while it loads: that one opens at its top', () => {
    expect(atLastChangeOfA().press(1).press(1).pick('c.cs').settle().load().publish().open().header).toBe('c.cs');
  });

  it("goes from file to file at once where the selected file couldn't be read", () => {
    expect(atLastChangeOfA().press(1).settle().fail().press(1).header).toBe('c.cs');
  });
});
