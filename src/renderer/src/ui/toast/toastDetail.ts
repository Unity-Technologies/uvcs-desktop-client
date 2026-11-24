import { AUTO_DISMISS_MS, type Toast, type ToastKind } from './toastStore';

/**
 * How a toast's detail shows: folded to its first three lines (`.detail`'s line clamp in `Toast.module.css`), or whole
 * once the user unfolds it. Never a scroll box inside the card: a long message (an error's, with a URL or a path) reads
 * as text.
 */
export type DetailToggle = 'Show more' | 'Show less';

/** Where a toast's detail stands: an `update` can change or remove it after it was measured or unfolded. */
export interface DetailFold {
  hasDetail: boolean;
  unfolded: boolean;
}

/** The toggle under the detail: offered only when the folded detail hides some of its text, or once unfolded. */
export function detailToggleOf({ hasDetail, clipped, unfolded }: DetailFold & { clipped: boolean }): DetailToggle | null {
  if (!hasDetail) return null;
  if (unfolded) return 'Show less';
  return clipped ? 'Show more' : null;
}

/** How long the toast stays up: one the user unfolded to read stays until they dismiss it. */
export function autoDismissMsOf(kind: ToastKind, { hasDetail, unfolded }: DetailFold): number | null {
  return hasDetail && unfolded ? null : AUTO_DISMISS_MS[kind];
}

/** What an error toast's Copy puts on the clipboard, its title and message, to paste into a chat or a bug report. */
export function errorCopyTextOf(toast: Pick<Toast, 'kind' | 'title' | 'detail'>): string | null {
  if (toast.kind !== 'error' || !toast.detail) return null;
  return `${toast.title}\n${toast.detail}`;
}
