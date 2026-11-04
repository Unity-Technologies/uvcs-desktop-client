import { describe, expect, it } from 'vitest';
import { openingStep, positionLabel } from './changeNavigation';
import { headerArrows } from './diffFrameHost';
import { fileSteps, type PendingArrival } from './fileSteps';
import { pressStep } from './stepNavigation';
import { StepQueue } from './stepQueue';
import type { StepNavigation } from './useStepNavigation';

/** Stands for a published navigation: `headerArrows` only asks whose it is. */
const NAVIGATION = { noun: 'change' } as StepNavigation;

/**
 * Clicking ↓ through a list of files while their diffs load, as `SteppedDiffFrame` and `LoadedFileDiff` do: the header
 * decides whose arrows they are (`headerArrows`); presses made before the selected file's diff opened wait in the
 * frame's queue (`StepQueue`), tagged with that file, and the diff drains them once it opened at its arrival. The
 * timeline is the real one: the data arrives, the new diff mounts while the old one's navigation is still the one
 * published (publishing follows the render), then it publishes, then opens.
 */
class LoadingDiffs {
  private selected = '';
  /** The diff drawn: whose, where it stands, whether it opened at its arrival. */
  private body: { path: string; current: number | null; opened: boolean } | null = null;
  private published: string | null = null;
  private hasData = false;
  private isPlaceholderData = false;
  private error = false;
  private readonly queue = new StepQueue();
  private readonly pending: { current: PendingArrival | null } = { current: null };

  constructor(private readonly files: Record<string, number>) {
    this.pick(Object.keys(files)[0]!).load().publish().open();
  }

  /** The file selected, and "3 of 12" while its own diff stands on a change. */
  get header(): string {
    const own = this.body?.path === this.selected ? this.body : null;
    const label = own ? positionLabel({ count: this.files[own.path]!, current: own.current }) : '';
    return label ? `${this.selected}: ${label}` : this.selected;
  }

  /** ↓ (1) or ↑ (-1) on the header's arrows, as the arrows shown take it. */
  press(direction: 1 | -1): this {
    const arrows = headerArrows({
      published: this.published === null ? null : { navigation: NAVIGATION, stepsOwn: true, key: this.published },
      requestedKey: this.selected,
      error: this.error,
      hasData: this.hasData,
      isPlaceholderData: this.isPlaceholderData,
    });
    if (arrows.body) this.bodyGo(direction);
    else if (arrows.queues) this.queue.push(this.selected, direction);
    else this.steps().step(direction);
    return this;
  }

  /** A file picked in the list: the previous diff stays on screen while it's read. */
  pick(path: string): this {
    this.selected = path;
    this.isPlaceholderData = this.hasData;
    this.error = false;
    return this;
  }

  /** The selected file's versions arrive: its diff mounts, the previous one's navigation still published. */
  load(): this {
    this.hasData = true;
    this.isPlaceholderData = false;
    this.body = { path: this.selected, current: null, opened: false };
    return this;
  }

  /** The new diff publishes its navigation (a layout effect, after the render that mounted it). */
  publish(): this {
    this.published = this.body!.path;
    return this;
  }

  /** The new diff opens at its arrival, then drains the presses kept for it. */
  open(): this {
    const body = this.body!;
    const opening = openingStep(this.steps().takeArrival(body.path), this.files[body.path]!, false);
    body.current = opening?.movesTo ? opening.index : null;
    body.opened = true;
    for (let kept = this.queue.take(body.path); kept !== undefined; kept = this.queue.take(body.path)) this.bodyGo(kept);
    return this;
  }

  /** The selected file couldn't be read. */
  fail(): this {
    this.error = true;
    this.body = null;
    this.published = null;
    return this;
  }

  /** The diff's own go: kept until it opened, then a step (on to the next file past its last change). */
  private bodyGo(direction: 1 | -1): void {
    const body = this.body!;
    if (!body.opened) return this.queue.push(body.path, direction);
    const outcome = pressStep({ count: this.files[body.path]!, current: body.current, above: 0 }, direction, this.steps(), () => 0);
    if (typeof outcome === 'number') body.current = outcome;
  }

  private steps() {
    return fileSteps(Object.keys(this.files), this.selected, { select: (key) => this.pick(key), pathOf: (key) => key }, this.pending);
  }
}

const atLastChangeOfA = () => new LoadingDiffs({ 'a.cs': 3, 'b.cs': 3, 'c.cs': 2 }).press(1).press(1).press(1);

describe('clicking ↓ while the next diff loads', () => {
  it("keeps presses while the next file's diff, read fast, mounted but the previous one's navigation is still published", () => {
    const list = atLastChangeOfA();
    expect(list.header).toBe('a.cs: 3 of 3');
    list.press(1).press(1).load();
    // The previous diff's navigation is still the one published: the arrows keep presses, never stepping from it.
    expect(list.press(1).header).toBe('b.cs');
    expect(list.publish().open().header).toBe('b.cs: 3 of 3');
  });

  it('applies each press once, none lost nor doubled: ↓↓ ends on the 2nd change, ↓↓↓ on the 3rd', () => {
    expect(atLastChangeOfA().press(1).press(1).load().publish().open().header).toBe('b.cs: 2 of 3');
    expect(atLastChangeOfA().press(1).press(1).press(1).load().publish().open().header).toBe('b.cs: 3 of 3');
  });

  it('keeps a press made after the new diff mounted but before it opened', () => {
    expect(atLastChangeOfA().press(1).load().publish().press(1).open().header).toBe('b.cs: 2 of 3');
  });

  it('drops the presses meant for a file once another is picked while it loads: that one opens at its top', () => {
    expect(atLastChangeOfA().press(1).press(1).pick('c.cs').load().publish().open().header).toBe('c.cs');
  });

  it("goes from file to file at once where the selected file couldn't be read", () => {
    expect(atLastChangeOfA().press(1).fail().press(1).header).toBe('c.cs');
  });
});
