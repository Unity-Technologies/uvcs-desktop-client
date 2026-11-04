import { describe, expect, it } from 'vitest';
import { openingStep, positionLabel, type ChangePosition } from './changeNavigation';
import { headerArrows } from './diffFrameHost';
import { fileSteps, pendingArrival, settlingOnOf } from './fileSteps';
import { applyPress, pressGoal, takesKept, type PressEffect, type PressSpot } from './pressRouting';
import { drainKept } from './stepQueue';
import type { StepNavigation } from './useStepNavigation';

/** Stands for a published navigation: `headerArrows` only asks whose it is. */
const NAVIGATION = { noun: 'change' } as StepNavigation;

/** The header's own navigation has no steps: it keeps presses or goes from file to file. */
const NO_STEPS: ChangePosition = { count: 0, current: null, above: 0 };

/** A navigation as the app holds one: where its presses go (`PressSpot`), where it stands, and how it moves. */
interface Navigator {
  spot: PressSpot;
  position: ChangePosition;
  moveTo: (index: number) => void;
}

/**
 * Clicking ↓ through a list of files whose diffs are read from the cache (the fast path), as `SteppedDiffFrame` and
 * `LoadedFileDiff` do, through the very decisions they take: whose the arrows are (`headerArrows`), where a press goes
 * and what it does (`pressGoal`, `applyPress`, both on `routePress`), and when a navigation takes the presses kept for
 * it (`takesKept`, `drainKept`: a render coming only where the app's would, a move, a change of the list's selection,
 * the diff opening). A diff page and Incoming ask for the file selected at once; Changes once its selection settled
 * (`settles`). A file with no changes (0) is an image: it opens as it's drawn; a text diff opens at its arrival a frame
 * later (`frame`); an xlink shows where it points instead of a diff, with arrows of its own (`FileOnlyNavigator`).
 */
class CachedDiffs {
  private listCurrent = '';
  /** The file the list was on as it last rendered: what its `FileSteps` know, until it renders again. */
  private rendered = '';
  private requested = '';
  private body: { path: string; current: number | null; opened: boolean } | null = null;
  private published: string | null = null;
  private error = false;
  private rendersDue = false;
  private requestDue = false;
  /** Unsaved edits are kept: the list asks before leaving the file, and the user cancels. */
  private refusing = false;
  private readonly pending = pendingArrival();
  private readonly items = new Map<string, { path: string }>();
  private readonly queue = this.pending.kept;

  constructor(
    private readonly files: Record<string, number | 'xlink'>,
    private readonly settles = false,
  ) {
    this.pick(Object.keys(files)[0]!).settle().frame();
  }

  /** The file selected in the list, and "3 of 12" while its own diff stands on a change. */
  get header(): string {
    const own = this.body?.path === this.listCurrent ? this.body : null;
    const label = own ? positionLabel({ count: this.changes(own.path), current: own.current }) : '';
    return label ? `${this.listCurrent}: ${label}` : this.listCurrent;
  }

  /**
   * ↓ (1) or ↑ (-1) on the header's arrows, as `SteppedDiffFrame` shows them: the body's once it's the selected file's,
   * else its own.
   */
  press(direction: 1 | -1): this {
    this.pressUnrendered(direction);
    return this.renders();
  }

  /** Presses faster than the view renders: each one sees the list as it last rendered. */
  burst(...directions: (1 | -1)[]): this {
    for (const direction of directions) this.pressUnrendered(direction);
    return this.renders();
  }

  private pressUnrendered(direction: 1 | -1): void {
    const navigator = this.xlinkNavigator() ?? (this.arrows().body ? this.bodyNavigator()! : this.headerNavigator());
    // A click on an arrow disabled (nowhere to go) does nothing.
    if (pressGoal(navigator.spot, navigator.position, direction, this.steps()) === null) return;
    this.go(navigator, direction);
  }

  /** A file picked in the list: a diff page and Incoming ask for it as they render next. */
  pick(path: string): this {
    this.listCurrent = path;
    this.rendersDue = true;
    this.requestDue = !this.settles;
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

  /** The file shown has unsaved edits, and the user cancels leaving it (`selectAfterLeaving`), until `allowLeaving`. */
  refuseLeaving(): this {
    this.refusing = true;
    return this;
  }

  allowLeaving(): this {
    this.refusing = false;
    return this;
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
    // An xlink has no diff: its own arrows take the presses (`xlinkNavigator`).
    this.body = this.files[path] === 'xlink' ? null : { path, current: null, opened: false };
    this.published = this.body ? path : null;
    // An image opens as it's drawn (nothing to arrive at, `noStepsComing`).
    if (this.body && this.files[path] === 0) this.open(this.body);
    this.rendersDue = true;
  }

  private open(body: { path: string; current: number | null; opened: boolean }): void {
    const opening = openingStep(this.steps().takeArrival(body.path), this.changes(body.path), false);
    body.current = opening?.movesTo ? opening.index : null;
    body.opened = true;
    this.rendersDue = true;
  }

  /** Each render: the header's own navigation and the diff's each take the presses kept for them, if they may. */
  private renders(): this {
    while (this.rendersDue) {
      this.rendersDue = false;
      if (this.rendered !== this.listCurrent) {
        this.rendered = this.listCurrent;
        this.steps().listMoved();
      }
      if (this.requestDue) {
        this.requestDue = false;
        this.request(this.listCurrent);
      }
      const xlink = this.xlinkNavigator();
      if (xlink) this.drain(xlink, true);
      else this.drain(this.headerNavigator(), true);
      const body = this.bodyNavigator();
      if (body) this.drain(body, body.spot.path === this.requested);
    }
    return this;
  }

  private drain(navigator: Navigator, selected: boolean): void {
    if (!takesKept(navigator.spot.holder, { opened: navigator.spot.opened, selected })) return;
    drainKept(this.queue, navigator.spot.path, (direction) => this.go(navigator, direction));
  }

  private go(navigator: Navigator, direction: 1 | -1): PressEffect {
    return applyPress(direction, navigator.spot, { position: navigator.position, files: this.steps(), queue: this.queue, readAbove: () => 0, moveTo: navigator.moveTo });
  }

  /** The diff's own navigation (`LoadedFileDiff`), while one is drawn. */
  private bodyNavigator(): Navigator | null {
    const body = this.body;
    if (!body) return null;
    return {
      spot: { holder: 'view', path: body.path, opened: body.opened, steppingTo: this.steps().steppingTo(), settlingOn: this.steps().settlingOn },
      position: { count: this.changes(body.path), current: body.current, above: 0 },
      moveTo: (index) => {
        body.current = index;
        this.rendersDue = true;
      },
    };
  }

  /** An xlink's arrows (`FileOnlyNavigator`), while the file asked for is one: no steps, from file to file. */
  private xlinkNavigator(): Navigator | null {
    if (this.files[this.requested] !== 'xlink') return null;
    const spot: PressSpot = { holder: 'stepless', path: this.requested, opened: false, steppingTo: this.steps().steppingTo(), settlingOn: this.steps().settlingOn };
    return { spot, position: NO_STEPS, moveTo: () => undefined };
  }

  /**
   * The list's item for a path, the same object each time: what Changes compares, the change selected and the one
   * diffed.
   */
  private item(path: string): { path: string } | undefined {
    if (path === '') return undefined;
    let item = this.items.get(path);
    if (!item) this.items.set(path, (item = { path }));
    return item;
  }

  private changes(path: string): number {
    const changes = this.files[path];
    return typeof changes === 'number' ? changes : 0;
  }

  /**
   * The header's own navigation (`SteppedDiffFrame`): waiting for the selected file's diff, or stepless where it
   * failed.
   */
  private headerNavigator(): Navigator {
    const spot: PressSpot = { holder: this.arrows().own, path: this.requested, opened: false, steppingTo: this.steps().steppingTo(), settlingOn: this.steps().settlingOn };
    return { spot, position: NO_STEPS, moveTo: () => undefined };
  }

  private steps() {
    return fileSteps(Object.keys(this.files), this.rendered, {
        select: (key, selected) => {
          if (this.refusing) return;
          selected();
          this.pick(key);
        },
        pathOf: (key) => key,
        // Changes: the list on another file than its diff shows, until the selection settles (`diffChange`).
        settlingOn: settlingOnOf(this.item(this.rendered), this.item(this.settles ? this.requested : this.rendered)),
      }, this.pending);
  }
}

const atLastChangeOfA = (files: Record<string, number | 'xlink'>, settles = false) => new CachedDiffs({ 'a.cs': 3, ...files }, settles).press(1).press(1).press(1);

describe('a burst of ↓ across diffs read from the cache', () => {
  it('lands ↓↓↓ from A\'s last change across a one-change file on the next file\'s 2nd change, no press lost on the way', () => {
    const list = atLastChangeOfA({ 'b.cs': 1, 'c.cs': 2 });
    expect(list.header).toBe('a.cs: 3 of 3');
    expect(list.press(1).press(1).press(1).frame().frame().header).toBe('c.cs: 2 of 2');
  });

  it("crosses an xlink the same way, its own arrows replaying the presses kept for it as steps from it", () => {
    expect(atLastChangeOfA({ 'b.cs': 'xlink', 'c.cs': 2 }).burst(1, 1, 1).frame().header).toBe('c.cs: 2 of 2');
  });

  it('crosses an image the same way', () => {
    expect(atLastChangeOfA({ 'logo.png': 0, 'c.cs': 2 }).press(1).press(1).press(1).frame().header).toBe('c.cs: 2 of 2');
  });

  it('lands ↓↓↓↓ in Changes, whose diff follows the selection once it settled, one change at a time', () => {
    const list = atLastChangeOfA({ 'b.cs': 1, 'c.cs': 2, 'd.cs': 2 }, true).press(1).press(1).press(1).press(1);
    expect(list.settle().frame().settle().frame().settle().frame().header).toBe('d.cs: 1 of 2');
  });

  it('goes on past a press that moves nothing: ↓↓↓↑ ending past the last change of the last file lands one change back', () => {
    expect(atLastChangeOfA({ 'b.cs': 2 }).press(1).press(1).press(1).press(-1).frame().header).toBe('b.cs: 1 of 2');
  });

  it('goes on past ↑ at the first change of the first file, to the presses behind it', () => {
    const list = new CachedDiffs({ 'a.cs': 1, 'b.cs': 2 }).press(1).press(1);
    expect(list.press(-1).press(-1).press(1).frame().frame().frame().header).toBe('b.cs: 1 of 2');
  });

  it('keeps for the next file the presses made before the list rendered on it, never stepping from the previous file again', () => {
    expect(atLastChangeOfA({ 'b.cs': 2 }).burst(1, 1, 1).press(-1).frame().header).toBe('b.cs: 1 of 2');
  });

  it("keeps ↓ enabled while a step to the list's last file settles in Changes: ↓↓↓↑ there loses no click", () => {
    expect(atLastChangeOfA({ 'b.cs': 2 }, true).press(1).press(1).press(1).press(-1).settle().frame().header).toBe('b.cs: 1 of 2');
  });

  it('the same in Changes, whose diff follows the selection once it settled', () => {
    expect(atLastChangeOfA({ 'b.cs': 2 }, true).burst(1, 1, 1).press(-1).settle().frame().header).toBe('b.cs: 1 of 2');
  });

  it('applies ↓↓↑ in order', () => {
    expect(atLastChangeOfA({ 'b.cs': 3 }).press(1).press(1).press(-1).frame().header).toBe('b.cs: 1 of 3');
  });

  it('keeps the presses for the next file while the previous one\'s diff, still shown, is drawn again', () => {
    expect(atLastChangeOfA({ 'b.cs': 3 }, true).press(1).press(1).rerender().settle().frame().header).toBe('b.cs: 2 of 3');
  });

  it('keeps for the file picked in Changes a press made before its selection settled, never stepping the previous file', () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }, true).pick('c.cs').rerender().press(1).settle().frame().header).toBe('c.cs: 1 of 2');
  });

  it('drops the presses meant for a file once another is picked while it loads: that one opens at its top', () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }, true).press(1).press(1).pick('c.cs').settle().frame().header).toBe('c.cs');
  });

  it('keeps stepping through the file shown after its unsaved edits were kept, and picking the next later replays nothing', () => {
    const list = atLastChangeOfA({ 'b.cs': 3 }).refuseLeaving().press(1).press(-1);
    expect(list.header).toBe('a.cs: 2 of 3');
    expect(list.allowLeaving().pick('b.cs').frame().header).toBe('b.cs');
  });

  it("replays the presses kept for a file that couldn't be read as steps from it, so a burst across it loses none", () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }).press(1).press(1).press(1).fail().frame().header).toBe('c.cs: 2 of 2');
  });

  it("keeps for the file a step went to the presses made on an unreadable file before the list rendered on it", () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }).press(1).fail().burst(1, 1).frame().header).toBe('c.cs: 2 of 2');
  });

  it('the same in Changes, whose diff follows the selection once it settled', () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }, true).press(1).settle().fail().burst(1, 1).settle().frame().header).toBe('c.cs: 2 of 2');
  });

  it("goes from file to file at once where the selected file couldn't be read", () => {
    expect(atLastChangeOfA({ 'b.cs': 3, 'c.cs': 2 }).press(1).fail().press(1).frame().header).toBe('c.cs: 1 of 2');
  });
});
