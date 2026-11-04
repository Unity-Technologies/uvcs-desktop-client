import { describe, expect, it } from 'vitest';
import { openingStep, positionLabel } from './changeNavigation';
import { drainsKept, headerArrows, headerPress, isSelectedFile } from './diffFrameHost';
import { fileSteps, type PendingArrival } from './fileSteps';
import { pressStep } from './stepNavigation';
import { pressTarget, StepQueue } from './stepQueue';
import type { StepNavigation } from './useStepNavigation';

/** Stands for a published navigation: `headerArrows` only asks whose it is. */
const NAVIGATION = { noun: 'change' } as StepNavigation;

/**
 * Clicking ↓ through a list of files whose diffs are read from the cache (the fast path), as `SteppedDiffFrame` and
 * `LoadedFileDiff` do, through the same decisions: whose the arrows are (`headerArrows`), where the header's press
 * goes (`headerPress`), where a diff's own goes (`pressTarget`), when a diff takes the presses kept for it
 * (`drainsKept`, one per render, a render coming only where the app's would: a move, a change of the list's
 * selection, the diff opening), and how kept presses follow a step (`StepQueue.retag`) or are dropped when the
 * selection leaves their file (`StepQueue.keepOnly`). A diff page and Incoming ask for the file selected at once;
 * Changes once its selection settled (`settles`). A file with no changes (0) is an image: it opens as it's drawn; a
 * text diff opens at its arrival a frame later (`frame`).
 */
class CachedDiffs {
  private listCurrent = '';
  private requested = '';
  private body: { path: string; current: number | null; opened: boolean } | null = null;
  private published: string | null = null;
  private error = false;
  private rendersDue = false;
  private readonly queue = new StepQueue();
  private readonly pending: { current: PendingArrival | null } = { current: null };

  constructor(
    private readonly files: Record<string, number>,
    private readonly settles = false,
  ) {
    this.pick(Object.keys(files)[0]!).settle().frame();
  }

  /** The file selected in the list, and "3 of 12" while its own diff stands on a change. */
  get header(): string {
    const own = this.body?.path === this.listCurrent ? this.body : null;
    const label = own ? positionLabel({ count: this.files[own.path]!, current: own.current }) : '';
    return label ? `${this.listCurrent}: ${label}` : this.listCurrent;
  }

  /** ↓ (1) or ↑ (-1) on the header's arrows. */
  press(direction: 1 | -1): this {
    const route = headerPress(this.arrows(), { steppingTo: this.steps().steppingTo(), requestedPath: this.requested });
    if (route.kind === 'body') this.bodyGo(direction);
    else if (route.kind === 'keep') this.queue.push(route.path, direction);
    else this.steps().step(direction);
    return this.renders();
  }

  /** A file picked in the list. */
  pick(path: string): this {
    this.listCurrent = path;
    this.rendersDue = true;
    if (!this.settles) this.request(path);
    return this;
  }

  /** Changes: its selection settled, the diff pane asks for it. */
  settle(): this {
    this.request(this.listCurrent);
    return this.renders();
  }

  /** A frame later: a text diff drawn opens at its arrival. */
  frame(): this {
    const body = this.body;
    if (body && !body.opened) this.open(body);
    return this.renders();
  }

  /** The selected file couldn't be read. */
  fail(): this {
    this.error = true;
    this.body = null;
    this.published = null;
    this.rendersDue = true;
    return this.renders();
  }

  /** Something else draws the view again (the list refreshed). */
  rerender(): this {
    this.rendersDue = true;
    return this.renders();
  }

  private arrows() {
    const published = this.published === null ? null : { navigation: NAVIGATION, stepsOwn: true, key: this.published };
    return headerArrows({ published, requestedKey: this.requested, error: this.error, hasData: !this.error, isPlaceholderData: false });
  }

  /** The diff pane asks for a file: read from the cache, its diff is drawn and published in the same render. */
  private request(path: string): void {
    this.requested = path;
    this.error = false;
    this.queue.keepOnly([path, this.steps().steppingTo()]);
    this.body = { path, current: null, opened: false };
    this.published = path;
    // An image opens as it's drawn (nothing to arrive at, `noStepsComing`).
    if (this.files[path] === 0) this.open(this.body);
    this.rendersDue = true;
  }

  private open(body: { path: string; current: number | null; opened: boolean }): void {
    const opening = openingStep(this.steps().takeArrival(body.path), this.files[body.path]!, false);
    body.current = opening?.movesTo ? opening.index : null;
    body.opened = true;
    this.rendersDue = true;
  }

  /** Each render: the header drops what a failed read left; the diff takes one press kept for it, once it may. */
  private renders(): this {
    while (this.rendersDue) {
      this.rendersDue = false;
      if (this.arrows().dropsKept) this.queue.clear();
      const body = this.body;
      if (!body || !drainsKept({ opened: body.opened, selected: isSelectedFile(body.path, this.requested) })) continue;
      const kept = this.queue.take(body.path);
      if (kept !== undefined) this.bodyGo(kept);
    }
    return this;
  }

  /** The diff's own go: kept for the file it's for, else a step, the presses left for it following a step to a file. */
  private bodyGo(direction: 1 | -1): void {
    const body = this.body!;
    const target = pressTarget({ opens: true, opened: body.opened, steppingTo: this.steps().steppingTo(), path: body.path });
    if (target.kind === 'keep') return this.queue.push(target.path, direction);
    const outcome = pressStep({ count: this.files[body.path]!, current: body.current, above: 0 }, direction, this.steps(), () => 0);
    if (typeof outcome === 'number') {
      body.current = outcome;
      this.rendersDue = true;
    } else if (outcome !== null) {
      this.queue.retag(body.path, outcome.file);
    }
  }

  private steps() {
    return fileSteps(Object.keys(this.files), this.listCurrent, { select: (key) => this.pick(key), pathOf: (key) => key }, this.pending);
  }
}

const atLastChangeOfA = (files: Record<string, number>, settles = false) => new CachedDiffs({ 'a.cs': 3, ...files }, settles).press(1).press(1).press(1);

describe('a burst of ↓ across diffs read from the cache', () => {
  it('lands ↓↓↓ from A\'s last change across a one-change file on the next file\'s 2nd change, no press lost on the way', () => {
    const list = atLastChangeOfA({ 'b.cs': 1, 'c.cs': 2 });
    expect(list.header).toBe('a.cs: 3 of 3');
    expect(list.press(1).press(1).press(1).frame().frame().header).toBe('c.cs: 2 of 2');
  });

  it('crosses an image the same way', () => {
    expect(atLastChangeOfA({ 'logo.png': 0, 'c.cs': 2 }).press(1).press(1).press(1).frame().header).toBe('c.cs: 2 of 2');
  });

  it('lands ↓↓↓↓ in Changes, whose diff follows the selection once it settled, one change at a time', () => {
    const list = atLastChangeOfA({ 'b.cs': 1, 'c.cs': 2, 'd.cs': 2 }, true).press(1).press(1).press(1).press(1);
    expect(list.settle().frame().settle().frame().settle().frame().header).toBe('d.cs: 1 of 2');
  });

  it('applies ↓↓↑ in order', () => {
    expect(atLastChangeOfA({ 'b.cs': 3 }).press(1).press(1).press(-1).frame().header).toBe('b.cs: 1 of 3');
  });

  it('keeps the presses for the next file while the previous one\'s diff, still shown, is drawn again', () => {
    expect(atLastChangeOfA({ 'b.cs': 3 }, true).press(1).press(1).rerender().settle().frame().header).toBe('b.cs: 2 of 3');
  });

  it('drops the presses meant for a file once another is picked while it loads: that one opens at its top', () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }, true).press(1).press(1).pick('c.cs').settle().frame().header).toBe('c.cs');
  });

  it("goes from file to file at once where the selected file couldn't be read", () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }).press(1).fail().press(1).frame().header).toBe('c.cs: 1 of 2');
  });
});
