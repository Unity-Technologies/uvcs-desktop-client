import { hotkey } from '../../lib/shortcutRegistry';
import { formatShortcut } from '../../lib/shortcuts';
import { copyToClipboard } from '../../ui/copyToClipboard';
import type { Page } from '../navigation/pages';
import type { LinkTarget } from './linkNavigation';
import { workspaceLinkTo } from './linkTo';
import { nextTimeHint, pageLinkTarget, pageObjectTarget } from './shownLink';
import { shownFileNow } from './useShownFile';

/**
 * Copies a link to the lines selected in a page (or the file it shows), as ⇧⌘C does then: from the line chip and the
 * lines' menu, whose toast teaches the shortcut.
 */
export function copyPageLink(workspacePath: string, page: Page): Promise<void> {
  return copyTarget(workspacePath, pageLinkTarget(page, shownFileNow(page)), nextTimeHint(formatShortcut(hotkey('copyLink'))));
}

/** Copies a link to the page's own object (`pageObjectTarget`): its header's "Copy link". */
export function copyPageObjectLink(workspacePath: string, page: Page): Promise<void> {
  return copyTarget(workspacePath, pageObjectTarget(page, shownFileNow(page)));
}

/** Copies a link to lines selected outside any page (the Files view: `LineLinks.linkOf`), as the chip and menu do. */
export function copyLinesLink(workspacePath: string, target: LinkTarget | null): Promise<void> {
  return copyTarget(workspacePath, target, nextTimeHint(formatShortcut(hotkey('copyLink'))));
}

async function copyTarget(workspacePath: string, target: LinkTarget | null, hint?: string): Promise<void> {
  if (target) copyToClipboard(await workspaceLinkTo(workspacePath, target)(), 'Link', hint);
}
