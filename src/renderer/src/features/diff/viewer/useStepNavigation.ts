import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { isModalDialogOpen } from '../../../lib/modalDialog';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { openingStep, plannedMove } from './changeNavigation';
import { FileStepsContext, type Arrival } from './fileSteps';
import { positionAfterChange, pressStep } from './stepNavigation';
import { drainKept, drainsKept, followStep, pressTarget, StepQueue, type PressEffect } from './stepQueue';
import type { ArrowGoal } from './changeNavigatorView';

/** Frames to wait, after a step from the file beside it, for the view to show: it may still be loading. */
const ARRIVAL_MAX_FRAMES = 60;

/**
 * Moving step by step through what a view shows (a diff's changes, a merged file's conflicts): the header's arrows
 * (`ChangeNavigator`) and the keys. `noun` names a step; `shortcuts` are its keys, next and previous.
 */
export interface StepNavigation {
  noun: string;
  shortcuts: StepShortcuts;
  count: number;
  /** The step moved to, by index; none before the first move or once the steps are others. */
  current: number | null;
  /** Where a move goes: to a step, on to the file beside it in the list (past the ends), or nowhere. */
  goesTo: (direction: 1 | -1) => ArrowGoal;
  go: (direction: 1 | -1) => void;
  /** For the view's scrolling element: where the first move goes from follows the view. */
  onViewScroll: () => void;
}

export interface StepShortcuts {
  next: ShortcutId;
  previous: ShortcutId;
}

/** What the navigation asks of the view on screen. */
export interface StepView {
  /** Whether the view is on screen to move in: a step from the file beside it waits for it. */
  isShown: () => boolean;
  /** Brings the step at `index` into view. */
  reveal: (index: number) => void;
  /**
   * Brings the step at `index` into view as the view opens, without moving to it: not lit, nor picked. A view without
   * it opens where it is, unless stepped to from the file beside it.
   */
  show?: (index: number) => void;
  /** Whether the view opened on lines of its own (a link's), which it stays on unless stepped to. */
  opensOnLines?: () => boolean;
  /** How many steps start above the top of the view, read from the screen: where the first move goes from. */
  countAbove: () => number;
  /**
   * The same once the steps changed (to `count` of them), while rendering, without reading the screen: where the view
   * last stood (a diff's line at its top), or just before the conflict resolved there.
   */
  aboveAfterChange: (count: number) => number;
}

interface StepNavigationOptions {
  /** The steps, in order: when they change for as many others, the step moved to stays (`positionAfterChange`). */
  steps: readonly unknown[];
  view: StepView;
  /** The view and its header: the keys work from there, from the list beside it and with nothing focused. */
  frame: RefObject<HTMLElement | null>;
  /** The file shown, as the list beside it names it (`FileSteps.takeArrival`). */
  path: string;
  noun: string;
  shortcuts: StepShortcuts;
  /** Whether its keys work; off while another navigation of the same header takes them (a loaded diff's). */
  active?: boolean;
  /**
   * Whether it opens the view at a step (`openingStep`), taking the arrival from the file beside it. A navigation with
   * no view of its own (the arrows of a diff not loaded yet) opens nothing and leaves the arrival to the diff that loads.
   */
  opens?: boolean;
  /** The view will never have steps of its own (an image, a binary): it opens at once, taking the arrival. */
  noStepsComing?: boolean;
  /**
   * Where a move goes instead of through the steps: kept for the file that loads (`StepQueue`). Its arrows are then
   * enabled both ways, as the keys are, whatever the list beside it.
   */
  goes?: (direction: 1 | -1) => void;
  /**
   * Where presses kept for a file wait (`pressTarget`: before the view opened at its arrival, or while a step to another
   * file is in flight): the frame's (`StepQueue`, shared with its header's presses while the file is read), from which
   * this view takes its own once opened while it `takes` (it's the selected file's diff, not a previous one still on
   * screen); a queue of its own by default.
   */
  kept?: KeptPresses;
}

/** A queue of presses tagged with the file they're for, and whether this view takes its own from it. */
export interface KeptPresses {
  queue: StepQueue;
  takes: boolean;
}

/**
 * Moving step by step through a view: the header's arrows and the keys, which work from the view (`frame`, its header
 * included), from the list beside it on screen that has `MAIN_FOCUS` (the files, the revisions) and with nothing
 * focused; never from a text field or menu, nor behind a dialog. Beside a list of files (`FileStepsContext`), moving
 * past the last step goes on to the next file's first, and past the first to the previous file's last, as in the
 * official client.
 */
export function useStepNavigation({ steps, view, frame, path, noun, shortcuts, active = true, opens = true, noStepsComing = false, goes, kept }: StepNavigationOptions): StepNavigation {
  const files = useContext(FileStepsContext);
  const [current, setCurrent] = useState<number | null>(null);
  const [above, setAbove] = useState(0);
  const latestView = useRef(view);
  latestView.current = view;
  // The steps changed: the one moved to stays while there are as many.
  const [known, setKnown] = useState(steps);
  if (known !== steps) {
    const after = positionAfterChange({ count: known.length, current, above }, known, steps, view.aboveAfterChange(steps.length));
    setKnown(steps);
    setCurrent(after.current);
    setAbove(after.above);
  }

  const readAbove = useCallback((): number => {
    const count = latestView.current.countAbove();
    setAbove(count);
    return count;
  }, []);

  const scrollFrame = useRef(0);
  const onViewScroll = useCallback(() => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      readAbove();
    });
  }, [readAbove]);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  const position = { count: steps.length, current, above };
  const moveTo = (target: number): void => {
    setCurrent(target);
    latestView.current.reveal(target);
  };
  // Presses meant for a file whose view hasn't opened at its arrival wait for it (`pressTarget`), tagged with that file.
  const ownKept = useOwnKeptPresses();
  const keptPresses = kept ?? ownKept;
  const press = (direction: 1 | -1): PressEffect => {
    if (goes) {
      goes(direction);
      return 'kept';
    }
    const target = pressTarget({ opens, opened, steppingTo: files?.steppingTo() ?? null, path });
    if (target.kind === 'keep') {
      keptPresses.queue.push(target.path, direction);
      return 'kept';
    }
    const outcome = pressStep(position, direction, files, readAbove);
    // On to the next file: the presses left for this one follow it there, in order.
    if (typeof outcome !== 'number') return followStep(keptPresses.queue, path, outcome?.file ?? null);
    moveTo(outcome);
    return 'moved';
  };
  const go = (direction: 1 | -1): void => void press(direction);
  const latestPress = useRef(press);
  latestPress.current = press;
  const latestMoveTo = useRef(moveTo);
  latestMoveTo.current = moveTo;

  // Opened by a step from the file beside it: at its first or last step; opened otherwise, with its first step in
  // view (`openingStep`). Once, as the view first shows (or never, given up on): steps that come later, typed or
  // read again, leave the view where it is.
  const arrival = useRef<Arrival | null | undefined>(undefined);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (opened || !opens) return;
    if (arrival.current === undefined) arrival.current = files?.takeArrival(path) ?? null;
    // Nothing to arrive at, ever (an image, a binary, identical versions): open at once, the arrival taken, so presses
    // don't wait on a view that will never show steps. A text diff's steps may come a render later: it waits for them.
    if (noStepsComing) return setOpened(true);
    const from = arrival.current;
    let frames = 0;
    let frame = 0;
    const arrive = (): void => {
      const view = latestView.current;
      const shown = view.isShown();
      if (!shown && ++frames < ARRIVAL_MAX_FRAMES) {
        frame = requestAnimationFrame(arrive);
        return;
      }
      setOpened(true);
      const at = shown ? openingStep(from, steps.length, view.opensOnLines?.() ?? false) : null;
      if (at?.movesTo) latestMoveTo.current(at.index);
      else if (at) view.show?.(at.index);
    };
    // From the next frame, not at once: a development build's second mount (StrictMode) runs the view's cleanups,
    // which would stop the scroll started here, then this effect again, which would find the view opened already.
    frame = requestAnimationFrame(arrive);
    return () => cancelAnimationFrame(frame);
  }, [files, path, steps.length, opens, opened, noStepsComing]);

  // Once opened, the presses kept for this file (`drainKept`), each moving from where the last one left it; not by a
  // view kept on screen while another file is read, which isn't the one they're for.
  useEffect(() => {
    if (drainsKept({ opened, selected: keptPresses.takes })) drainKept(keptPresses.queue, path, (direction) => latestPress.current(direction));
  });

  const hasFiles = files !== null;
  useEffect(() => {
    if (!active || (steps.length === 0 && !hasFiles)) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      // Keys the editor took (⌥↓ ⌥↑ move lines while typing) are its own.
      if (event.defaultPrevented || isModalDialogOpen() || !takesKeysFrom(frame.current, event.target)) return;
      const pressed = (id: ShortcutId): boolean => hotkeys(id).some((key) => matchesShortcut(event, key));
      const direction = pressed(shortcuts.next) ? 1 : pressed(shortcuts.previous) ? -1 : 0;
      if (direction === 0) return;
      event.preventDefault();
      latestPress.current(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, steps.length, hasFiles, frame, shortcuts.next, shortcuts.previous]);

  return {
    noun,
    shortcuts,
    count: steps.length,
    current,
    // Kept for the file that loads: enabled both ways, as the keys are, wherever that file sits in the list.
    goesTo: (direction) => (goes ? 'queued' : (plannedMove(position, direction, files?.canStep(direction) ?? false)?.to ?? null)),
    go,
    onViewScroll,
  };
}

/**
 * Marks what holds a view and the controls that pick it (a conflicting file's panel, with its views' segments): keys
 * pressed anywhere in it move through the view, as from the view itself.
 */
export const STEP_FRAME = { 'data-step-frame': '' } as const;

/** A view's own queue of kept presses, where no frame shares one (the merge page's conflicts). */
function useOwnKeptPresses(): KeptPresses {
  const [own] = useState<KeptPresses>(() => ({ queue: new StepQueue(), takes: true }));
  return own;
}

/**
 * Whether a key pressed on `target` moves through the view in `frame`: pressed in it or in what holds it
 * (`STEP_FRAME`), in the list beside it, or with nothing focused (a header button disabled at the last step lets go
 * of the focus).
 */
function takesKeysFrom(frame: HTMLElement | null, target: EventTarget | null): boolean {
  if (!frame || !(target instanceof Element) || target.closest('input, textarea, select, [contenteditable="true"]')) return false;
  if (frame.contains(target) || frame.closest('[data-step-frame]')?.contains(target)) return true;
  return (target === document.body || target.closest('[data-main-focus]') !== null) && frame.checkVisibility();
}
