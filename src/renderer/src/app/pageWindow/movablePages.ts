import type { PageWindowOpening, PageWindowPage } from '@shared/domain/pageWindow';
import type { DiffEntry } from '@shared/domain/diff';
import type { Page, PageOf } from '../navigation/pages';

/**
 * The pages that open in a window of their own: documents about one object, read beside the workspace's window. A
 * merge stays in it: it writes to the workspace, and its window is where the user resolves and checks in.
 */
const MOVABLE_KINDS: readonly Page['kind'][] = ['diff', 'history', 'codeReview', 'browseRepository'];

export function isMovablePage(page: Page): boolean {
  return MOVABLE_KINDS.includes(page.kind);
}

/**
 * The page a page window was given (its address, a followed selection), when it is one that opens in a window of its
 * own; null otherwise. Only this app's pages travel there (`windows.openPage`), so its kind is all there is to check.
 */
export function asMovablePage(value: PageWindowPage): Page | null {
  return (MOVABLE_KINDS as readonly string[]).includes(value.kind) ? (value as unknown as Page) : null;
}

/**
 * What opens a page in a window of its own: its workspace, the page, and for a diff the files this window already
 * read of it (`cachedEntries`), so the page window doesn't run `cm diff` again.
 */
export function pageWindowOpening(workspacePath: string, page: Page, cachedEntries: (page: PageOf<'diff'>) => DiffEntry[] | undefined): PageWindowOpening {
  const opening: PageWindowOpening = { workspacePath, page };
  if (page.kind !== 'diff') return opening;
  const entries = cachedEntries(page);
  return entries ? { ...opening, diff: { target: page.target, entries } } : opening;
}
