import type { DiffTarget } from '@shared/domain/diff';
import type { LinkLines } from '@shared/links/link';
import type { ShownRevision } from '../../features/history/shownRevision';
import type { Page } from '../navigation/pages';
import type { ViewId } from '../navigation/views';
import { LINK_VIEW_IDS, type LinkTarget } from './linkNavigation';
import { diffTargetObject, isWritable } from './linkTo';

/** The file the page in front shows (a repository path, as `DiffEntry.path`), and the lines selected in it. */
export interface ShownFile {
  path: string;
  lines?: LinkLines;
  /** A history's: the revision it shows and how (`useShownRevision`), which may not be the one it opened on. */
  revision?: ShownRevision;
}

/**
 * What a link to the page in front names, as a browser's address bar would (docs/features/deep-links.md, "Where links
 * are copied"): the object a diff or a review shows, the file shown or the lines selected in it, the item a history or
 * a browse shows. Null for a page no link names (a merge, a diff of two branches' heads).
 */
export function pageLinkTarget(page: Page, shown: ShownFile | null): LinkTarget | null {
  const target = pageTargetOf(page, shown);
  if (!target || isWritable(target)) return target;
  // A file no link can carry (a quote in its name): a diff's or a review's object still can be.
  const object = (page.kind === 'diff' || page.kind === 'codeReview') && target.object;
  return object && isWritable({ object }) ? { object } : null;
}

function pageTargetOf(page: Page, shown: ShownFile | null): LinkTarget | null {
  switch (page.kind) {
    case 'diff': {
      const object = diffTargetObject(page.target);
      return object && { object, ...fileIn(page.focusPath, shown) };
    }
    case 'codeReview':
      return { object: { kind: 'codeReview', id: page.reviewId }, ...fileIn(page.focusPath, shown) };
    case 'history':
      return historyLinkTarget(page, shown);
    case 'browseRepository': {
      const path = shown?.path ?? page.focusPath;
      const lines = shown?.lines ? { lines: shown.lines } : {};
      return { object: { kind: 'changeset', id: page.changesetId }, page: { kind: 'browse', path: `/${path ?? ''}` }, ...lines };
    }
    case 'merge':
      return null;
  }
}

/**
 * A history's link: the revision it shows and how (else the one it opened on), with the lines selected in it
 * annotated. None for an item of another repository than the workspace's (under an xlink): a link names the
 * workspace's repository, where that changeset is another or none.
 */
function historyLinkTarget(page: Extract<Page, { kind: 'history' }>, shown: ShownFile | null): LinkTarget | null {
  const revision = shown?.revision;
  if (revision?.otherRepository) return null;
  const openedOn = page.select && 'changesetId' in page.select ? page.select.changesetId : undefined;
  const changesetId = revision?.changesetId ?? openedOn;
  const view = revision?.view ?? (page.view === 'annotate' ? 'annotate' : 'history');
  const lines = view === 'annotate' && shown?.lines && shown.path === page.path ? { lines: shown.lines } : {};
  return { ...(changesetId !== undefined && { object: { kind: 'changeset', id: changesetId } }), page: { kind: view, path: `/${page.path}` }, ...lines };
}

/** The file a diff shows and the lines selected in it, else the file it opened on. */
function fileIn(focusPath: string | undefined, shown: ShownFile | null): Pick<LinkTarget, 'page' | 'lines'> {
  const path = shown?.path ?? focusPath;
  if (!path) return {};
  return shown?.lines ? { page: { kind: 'diffFile', path: `/${path}` }, lines: shown.lines } : { page: { kind: 'diffFile', path: `/${path}` } };
}

/**
 * The file a page shows and the lines selected in it: a diff's or a review's from the diff on screen
 * (`useShownDiffFile`), none when that diff is another page's; an annotation's or a browsed file's from the lines
 * selected (`useSelectedLines`), and a history's revision (`useShownRevision`).
 */
export function shownFileOf(
  page: Page | undefined,
  onScreen: { target: DiffTarget; path: string } | null,
  selected: Required<Omit<ShownFile, 'revision'>> | null,
  revision: ShownRevision | null = null,
): ShownFile | null {
  if (page?.kind === 'history' && revision?.path === page.path) return { ...(selected ?? { path: page.path }), revision };
  if (page?.kind === 'history' || page?.kind === 'browseRepository') return selected;
  if (!onScreen || (page?.kind !== 'diff' && page?.kind !== 'codeReview')) return null;
  if (page.kind === 'diff' && JSON.stringify(onScreen.target) !== JSON.stringify(page.target)) return null;
  return selected?.path === onScreen.path ? selected : { path: onScreen.path };
}

/** What "Copy link" copies (`useCopyLinkCommand`): a link it names, or the one the view's selected object offers. */
export type LinkToCopy = { kind: 'target'; target: LinkTarget } | { kind: 'selectedObject' } | null;

/**
 * What "Copy link" copies, as a browser's address bar would: the page in front (with the file and lines it shows),
 * else the object selected in the view, else the view itself; nothing for a page or view no link names.
 */
export function linkToCopy({ top, shown, hasSelectedObject, view }: { top: Page | undefined; shown: ShownFile | null; hasSelectedObject: boolean; view: ViewId }): LinkToCopy {
  const target = top ? pageLinkTarget(top, shown) : hasSelectedObject ? null : viewLinkTarget(view);
  if (target) return { kind: 'target', target };
  return !top && hasSelectedObject ? { kind: 'selectedObject' } : null;
}

/**
 * Whether "Copy link" has a link to copy, to enable it (`useCopyLinkCommand`), from what the shell follows without
 * rendering as a selection moves: a history showing a revision of another repository has none (`historyLinkTarget`).
 */
export function hasLinkToCopy({ top, hasSelectedObject, view, shownOfOtherRepository }: { top: Page | undefined; hasSelectedObject: boolean; view: ViewId; shownOfOtherRepository: boolean }): boolean {
  if (top?.kind === 'history' && shownOfOtherRepository) return false;
  return linkToCopy({ top, shown: null, hasSelectedObject, view }) !== null;
}

/**
 * What a link to a view with nothing selected names: the view, in the workspace's repository; none for Changes and
 * Files, which show what is only on this computer (docs/features/deep-links.md, "Where links are copied").
 */
export function viewLinkTarget(view: ViewId): LinkTarget | null {
  if (view === 'changes' || view === 'files') return null;
  const linkView = (Object.keys(LINK_VIEW_IDS) as (keyof typeof LINK_VIEW_IDS)[]).find((name) => LINK_VIEW_IDS[name] === view)!;
  return { page: { kind: 'view', view: linkView } };
}

/** What "Copy link" says it copies, in its tooltip: "Copy link to lines 40–52 of Player.cs". */
export function copyLinkLabel(target: LinkTarget | null): string {
  const path = target?.page && 'path' in target.page ? target.page.path : undefined;
  const name = path && path !== '/' ? path.split('/').at(-1) : undefined;
  if (!target?.lines || !name) return name ? `Copy link to ${name}` : 'Copy link';
  const { first, last } = target.lines;
  return first === last ? `Copy link to line ${first} of ${name}` : `Copy link to lines ${first}–${last} of ${name}`;
}
