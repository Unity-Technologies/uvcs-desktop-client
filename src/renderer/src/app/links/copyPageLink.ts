import type { Place } from '@shared/domain/place';
import { hotkey } from '../../lib/shortcutRegistry';
import { formatShortcut } from '../../lib/shortcuts';
import { copyToClipboard } from '../../ui/copyToClipboard';
import type { FocusedLines, Page } from '../navigation/pages';
import type { LinkTarget } from './linkNavigation';
import { placeLinkTo } from './linkTo';
import { nextTimeHint, pageLinkTarget, pageObjectTarget } from './shownLink';
import { shownFileNow, shownFileWithLines } from './useShownFile';

/**
 * Copies a link to the lines selected in a page (or the file it shows), as ⇧⌘C does then: from the line chip and the
 * lines' menu, whose toast teaches the shortcut.
 */
export function copyPageLink(place: Place, page: Page): Promise<void> {
  return copyTarget(place, pageLinkTarget(page, shownFileNow(page)), copyLinkHint());
}

/**
 * The link to `lines` of the file `path` in a page, as if they were selected: the lines' menu's, which selects nothing.
 * None where the page's link can't name them (a browsed file's older side, a name no link can carry).
 */
export function pageLinesTarget(page: Page, path: string, lines: FocusedLines): LinkTarget | null {
  const target = pageLinkTarget(page, shownFileWithLines(page, { path, lines }));
  return target?.lines ? target : null;
}

/** Copies a link to the page's own object (`pageObjectTarget`): its header's "Copy link". */
export function copyPageObjectLink(place: Place, page: Page): Promise<void> {
  return copyTarget(place, pageObjectTarget(page, shownFileNow(page)));
}

/**
 * Copies a link to lines (the line chip's, the lines' menu's, in a page or the Files view): its toast teaches ⇧⌘C only
 * where ⇧⌘C copies the same, the lines selected (`teachesShortcut`).
 */
export function copyLinesLink(place: Place, target: LinkTarget | null, teachesShortcut = true): Promise<void> {
  return copyTarget(place, target, teachesShortcut ? copyLinkHint() : undefined);
}

/** The toast's hint of the key that copies the link, while it has one. */
function copyLinkHint(): string | undefined {
  const key = hotkey('copyLink');
  return key && nextTimeHint(formatShortcut(key));
}

async function copyTarget(place: Place, target: LinkTarget | null, hint?: string): Promise<void> {
  if (target) copyToClipboard(await placeLinkTo(place, target)(), 'Link', hint);
}
