import type { FileDiffMetadata } from '@pierre/diffs';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { isModalDialogOpen } from '../../../lib/modalDialog';
import { matchesShortcut } from '../../../lib/shortcuts';
import { hotkeys } from '../../../lib/shortcutRegistry';
import { listChangeBlocks, listChangeRegions } from './changeBlocks';
import { arrivalChange, changePositionLabel, changesAbove, currentAfterChange, plannedMove, type ChangeMove, type ChangePosition } from './changeNavigation';
import type { ChangeView } from './changeView';
import { FileStepsContext, type Arrival } from './fileSteps';

export interface ChangeNavigation {
  count: number;
  /** "3 of 12", or "12 changes" before the first move. */
  label: string;
  /** Where a move goes: to a change, on to the file beside it in the list (past the ends), or nowhere. */
  goesTo: (direction: 1 | -1) => 'change' | 'file' | null;
  go: (direction: 1 | -1) => void;
  /** For the diff's scrolling element: where the first move goes from follows the view. */
  onViewScroll: () => void;
}

/**
 * Moving from change to change in the diff shown (`diff`, the one `lineDiff` of the text as it is now, so the changes
 * follow what's typed): the header's arrows and the keys (⌥↓ ⌥↑, and F7 ⇧F7 which the editor leaves alone while
 * typing). The keys work from the diff (`frame`, its header included), from the list beside it on screen that has
 * `MAIN_FOCUS` (the files, the revisions) and with nothing focused; never from a text field or menu, nor behind a dialog.
 * Beside a list of files (`FileStepsContext`), moving past the last change goes on to the next file's first change,
 * and past the first to the previous file's last, as in the official client.
 */
export function useChangeNavigation(
  diff: FileDiffMetadata | null,
  view: RefObject<ChangeView | null>,
  frame: RefObject<HTMLElement | null>,
  /** The file shown, as the list beside it names it. */
  path: string,
): ChangeNavigation {
  const steps = useContext(FileStepsContext);
  const blocks = useMemo(() => (diff ? listChangeBlocks(diff) : []), [diff]);
  const regions = useMemo(() => listChangeRegions(blocks), [blocks]);
  const [current, setCurrent] = useState<number | null>(null);
  const [above, setAbove] = useState(0);
  const topLine = useRef(1);
  // The text changed: the change moved to stays while there are as many.
  const [known, setKnown] = useState(regions);
  if (known !== regions) {
    setKnown(regions);
    setCurrent(currentAfterChange(current, known, regions));
    setAbove(changesAbove(regions, topLine.current));
  }

  const readTop = useCallback((): number => {
    const line = view.current?.lineAtTop(blocks);
    if (line != null) topLine.current = line;
    const count = changesAbove(regions, topLine.current);
    setAbove(count);
    return count;
  }, [view, blocks, regions]);

  const scrollFrame = useRef(0);
  const onViewScroll = useCallback(() => {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      readTop();
    });
  }, [readTop]);
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), []);

  const position = { count: regions.length, current, above };
  const moveTo = (target: number): void => {
    setCurrent(target);
    view.current?.reveal(regions[target]!);
  };
  const plan = (from: ChangePosition, direction: 1 | -1): ChangeMove => plannedMove(from, direction, steps?.canStep(direction) ?? false);
  const go = (direction: 1 | -1): void => {
    const move = plan(current === null ? { ...position, above: readTop() } : position, direction);
    if (move?.to === 'change') moveTo(move.index);
    else if (move?.to === 'file') steps!.step(direction);
  };
  const latestGo = useRef(go);
  latestGo.current = go;

  // Opened by a step from the file beside it: at its first or last change, once the diff shows.
  const arrival = useRef<Arrival | null | undefined>(undefined);
  useEffect(() => {
    if (arrival.current === undefined) arrival.current = steps?.takeArrival(path) ?? null;
    const at = arrival.current ? arrivalChange(arrival.current, regions.length) : null;
    if (at === null) return;
    let frames = 0;
    let frame = 0;
    const arrive = (): void => {
      if (view.current) {
        arrival.current = null;
        return latestMoveTo.current(at);
      }
      if (++frames < 60) frame = requestAnimationFrame(arrive);
    };
    arrive();
    return () => cancelAnimationFrame(frame);
  }, [steps, path, regions.length, view]);
  const latestMoveTo = useRef(moveTo);
  latestMoveTo.current = moveTo;

  const hasSteps = steps !== null;
  useEffect(() => {
    if (regions.length === 0 && !hasSteps) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      // Keys the editor took (⌥↓ ⌥↑ move lines while typing) are its own.
      if (event.defaultPrevented || isModalDialogOpen() || !takesKeysFrom(frame.current, event.target)) return;
      const direction = hotkeys('nextChange').some((key) => matchesShortcut(event, key)) ? 1 : hotkeys('previousChange').some((key) => matchesShortcut(event, key)) ? -1 : 0;
      if (direction === 0) return;
      event.preventDefault();
      latestGo.current(direction);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [regions.length, hasSteps, frame]);

  return {
    count: regions.length,
    label: changePositionLabel(position),
    goesTo: (direction) => plan(position, direction)?.to ?? null,
    go,
    onViewScroll,
  };
}

/** Whether the navigation has somewhere to go: changes, or a file beside this one (a file with none still steps on). */
export function goesSomewhere(navigation: ChangeNavigation): boolean {
  return navigation.count > 0 || navigation.goesTo(1) !== null || navigation.goesTo(-1) !== null;
}

/**
 * Whether a key pressed on `target` moves through the diff in `frame`: pressed in it, in the list beside it, or with
 * nothing focused (a header button disabled at the last change lets go of the focus).
 */
function takesKeysFrom(frame: HTMLElement | null, target: EventTarget | null): boolean {
  if (!frame || !(target instanceof Element) || target.closest('input, textarea, select, [contenteditable="true"]')) return false;
  if (frame.contains(target)) return true;
  return (target === document.body || target.closest('[data-main-focus]') !== null) && frame.checkVisibility();
}
