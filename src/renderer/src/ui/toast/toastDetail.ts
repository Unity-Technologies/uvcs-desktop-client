import { AUTO_DISMISS_MS, type ToastKind } from './toastStore';

/**
 * How a toast's detail shows: folded to its first lines (`DETAIL_FOLDED_LINES`, a line clamp), or whole once the user
 * unfolds it. Never a scroll box inside the card: a long message (an error's, with a URL or a path) reads as text.
 */
export type DetailToggle = 'Show more' | 'Show less';

/** The toggle under the detail: offered only when the folded detail hides some of its text, or once unfolded. */
export function detailToggleOf(clipped: boolean, unfolded: boolean): DetailToggle | null {
  if (unfolded) return 'Show less';
  return clipped ? 'Show more' : null;
}

/** How long the toast stays up: one the user unfolded to read stays until they dismiss it. */
export function autoDismissMsOf(kind: ToastKind, unfolded: boolean): number | null {
  return unfolded ? null : AUTO_DISMISS_MS[kind];
}
