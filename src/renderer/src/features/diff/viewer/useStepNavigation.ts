import { useCallback, useContext, useEffect, useRef, useState, type RefObject } from 'react';
import { isModalDialogOpen } from '../../../lib/modalDialog';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkeys, type ShortcutId } from '../../../lib/shortcutRegistry';
import { arrivalChange, plannedMove, positionLabel } from './changeNavigation';
import { FileStepsContext, type Arrival } from './fileSteps';
import { positionAfterChange, pressStep } from './stepNavigation';

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
  /** "3 of 12", or "12 changes" before the first move. */
  label: string;
  /** Where a move goes: to a step, on to the file beside it in the list (past the ends), or nowhere. */
  goesTo: (direction: 1 | -1) => 'change' | 'file' | null;
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
  /** How many steps start above the top of the view, read from the screen: where the first move goes from. */
  countAbove: () => number;
  /**
   * The same once the steps changed, while rendering, without reading the screen: where the view last stood (a diff's
   * line at its top), or just before the conflict resolved there.
   */
  aboveAfterChange: () => number;
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
}

/**
 * Moving step by step through a view: the header's arrows and the keys, which work from the view (`frame`, its header
 * included), from the list beside it on screen that has `MAIN_FOCUS` (the files, the revisions) and with nothing
 * focused; never from a text field or menu, nor behind a dialog. Beside a list of files (`FileStepsContext`), moving
 * past the last step goes on to the next file's first, and past the first to the previous file's last, as in the
 * official client.
 */
export function useStepNavigation({ steps, view, frame, path, noun, shortcuts }: StepNavigationOptions): StepNavigation {
  const files = useContext(FileStepsContext);
  const [current, setCurrent] = useState<number | null>(null);
  const [above, setAbove] = useState(0);
  const latestView = useRef(view);
  latestView.current = view;
  // The steps changed: the one moved to stays while there are as many.
  const [known, setKnown] = useState(steps);
  if (known !== steps) {
    const after = positionAfterChange({ count: known.length, current, above }, known, steps, view.aboveAfterChange());
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
  const go = (direction: 1 | -1): void => {
    const outcome = pressStep(position, direction, files, readAbove);
    if (typeof outcome === 'number') moveTo(outcome);
  };
  const latestGo = useRef(go);
  latestGo.current = go;
  const latestMoveTo = useRef(moveTo);
  latestMoveTo.current = moveTo;

  // Opened by a step from the file beside it: at its first or last step, once the view shows.
  const arrival = useRef<Arrival | null | undefined>(undefined);
  useEffect(() => {
    if (arrival.current === undefined) arrival.current = files?.takeArrival(path) ?? null;
    const at = arrival.current ? arrivalChange(arrival.current, steps.length) : null;
    if (at === null) return;
    let frames = 0;
    let frame = 0;
    const arrive = (): void => {
      if (latestView.current.isShown()) {
        arrival.current = null;
        return latestMoveTo.current(at);
      }
      if (++frames < ARRIVAL_MAX_FRAMES) frame = requestAnimationFrame(arrive);
    };
    arrive();
    return () => cancelAnimationFrame(frame);
  }, [files, path, steps.length]);

  const hasFiles = files !== null;
  useEffect(() => {
    if (steps.length === 0 && !hasFiles) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      // Keys the editor took (⌥↓ ⌥↑ move lines while typing) are its own.
      if (event.defaultPrevented || isModalDialogOpen() || !takesKeysFrom(frame.current, event.target)) return;
      const pressed = (id: ShortcutId): boolean => hotkeys(id).some((key) => matchesShortcut(event, key));
      const direction = pressed(shortcuts.next) ? 1 : pressed(shortcuts.previous) ? -1 : 0;
      if (direction === 0) return;
      event.preventDefault();
      latestGo.current(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [steps.length, hasFiles, frame, shortcuts.next, shortcuts.previous]);

  return {
    noun,
    shortcuts,
    count: steps.length,
    label: positionLabel(position, noun),
    goesTo: (direction) => plannedMove(position, direction, files?.canStep(direction) ?? false)?.to ?? null,
    go,
    onViewScroll,
  };
}

/** Whether the navigation has somewhere to go: steps, or a file beside this one (a file with none still steps on). */
export function goesSomewhere(navigation: StepNavigation): boolean {
  return navigation.count > 0 || navigation.goesTo(1) !== null || navigation.goesTo(-1) !== null;
}

/**
 * Marks what holds a view and the controls that pick it (a conflicting file's panel, with its views' segments): keys
 * pressed anywhere in it move through the view, as from the view itself.
 */
export const STEP_FRAME = { 'data-step-frame': '' } as const;

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
