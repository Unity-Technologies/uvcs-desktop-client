import type { Place } from '@shared/domain/place';
import { hotkey } from '../../lib/shortcutRegistry';
import { formatShortcut } from '../../lib/shortcuts';
import { copyToClipboard } from '../../ui/copyToClipboard';
import type { Page } from '../navigation/pages';
import type { LinkTarget } from './linkNavigation';
import { placeLinkTo } from './linkTo';
import { nextTimeHint, pageLinkTarget, pageObjectTarget } from './shownLink';
import { shownFileNow } from './useShownFile';

/**
 * Copies a link to the lines selected in a page (or the file it shows), as ⇧⌘C does then: from the line chip and the
 * lines' menu, whose toast teaches the shortcut.
 */
export function copyPageLink(place: Place, page: Page): Promise<void> {
  return copyTarget(place, pageLinkTarget(page, shownFileNow(page)), nextTimeHint(formatShortcut(hotkey('copyLink'))));
}

/** Copies a link to the page's own object (`pageObjectTarget`): its header's "Copy link". */
export function copyPageObjectLink(place: Place, page: Page): Promise<void> {
  return copyTarget(place, pageObjectTarget(page, shownFileNow(page)));
}

/** Copies a link to lines selected outside any page (the Files view: `LineLinks.linkOf`), as the chip and menu do. */
export function copyLinesLink(place: Place, target: LinkTarget | null): Promise<void> {
  return copyTarget(place, target, nextTimeHint(formatShortcut(hotkey('copyLink'))));
}

async function copyTarget(place: Place, target: LinkTarget | null, hint?: string): Promise<void> {
  if (target) copyToClipboard(await placeLinkTo(place, target)(), 'Link', hint);
}
