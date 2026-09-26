import { api } from '../../api/client';
import type { SelectionState } from '../../lib/selection';

/** Settles what would be lost (asks, saves or drops it); resolves false when the user chooses to stay. */
export type LeaveGuard = () => Promise<boolean>;

let current: LeaveGuard | null = null;
let asking: Promise<boolean> | null = null;
// The guard let the page go: closing the window, quitting or reloading goes on without asking again.
let unloading = false;

/**
 * Something on screen that can't be left as it is, such as a file with unsaved edits, guards the way out: showing
 * another view or another file waits for it (`afterLeaving`). Returns the function that lifts the guard.
 */
export function guardLeaving(guard: LeaveGuard): () => void {
  current = guard;
  unloading = false;
  return () => {
    if (current === guard) current = null;
  };
}

/**
 * Runs `leave` at once when nothing guards the way out, otherwise once the guard lets it go. Ways out tried while the
 * guard is still asking are dropped: the user is answering about the first one.
 */
export function afterLeaving(leave: () => void): void {
  const guard = current;
  if (!guard) return leave();
  if (asking) return;
  void ask(guard).then((canLeave) => canLeave && leave());
}

/**
 * A list's new selection, applied once the guard lets go of what's shown, when it shows something else: another
 * item, or several. Moving within the same selection (re-clicking the row) never asks.
 */
export function selectAfterLeaving(current: SelectionState, next: SelectionState, select: (next: SelectionState) => void): void {
  if (next.anchor === current.anchor && next.selected.size === current.selected.size) return select(next);
  afterLeaving(() => select(next));
}

/** Resolves true once nothing is left to settle (the guard, if any, let it go). */
export function settleBeforeLeaving(): Promise<boolean> {
  return current ? ask(current) : Promise.resolve(true);
}

function ask(guard: LeaveGuard): Promise<boolean> {
  asking ??= guard().finally(() => {
    asking = null;
  });
  return asking;
}

/**
 * Closing the window, quitting or reloading the page asks too while something guards the way out: the page holds the
 * unloading back, the main process brings the window forward and asks (`leaveRequested`), and whatever unloaded it
 * goes on once the guard lets go (`windows.continueLeaving`); Cancel keeps the window as it is.
 */
export function guardUnloading(): void {
  window.addEventListener('beforeunload', (event) => {
    if (!current || unloading) return;
    event.preventDefault();
    event.returnValue = '';
  });
  window.uvcs.on('leaveRequested', () => {
    void settleBeforeLeaving().then((canLeave) => {
      if (canLeave) unloading = true;
      return api.windows.continueLeaving(canLeave);
    });
  });
}
