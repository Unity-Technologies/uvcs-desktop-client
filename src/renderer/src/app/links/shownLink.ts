import type { DiffTarget } from '@shared/domain/diff';
import type { LinkLines } from '@shared/links/link';
import type { Page } from '../navigation/pages';
import type { ViewId } from '../navigation/views';
import { LINK_VIEW_IDS, type LinkTarget } from './linkNavigation';
import { diffTargetObject } from './linkTo';

/** The file the page in front shows (a repository path, as `DiffEntry.path`), and the lines selected in it. */
export interface ShownFile {
  path: string;
  lines?: LinkLines;
}

/**
 * What a link to the page in front names, as a browser's address bar would (docs/features/deep-links.md, "Where links
 * are copied"): the object a diff or a review shows, the file shown or the lines selected in it, the item a history or
 * a browse shows. Null for a page no link names (a merge, a diff of two branches' heads).
 */
export function pageLinkTarget(page: Page, shown: ShownFile | null): LinkTarget | null {
  switch (page.kind) {
    case 'diff': {
      const object = diffTargetObject(page.target);
      return object && { object, ...fileIn(page.focusPath, shown) };
    }
    case 'codeReview':
      return { object: { kind: 'codeReview', id: page.reviewId }, ...fileIn(page.focusPath, shown) };
    case 'history': {
      const object = page.select && 'changesetId' in page.select ? ({ kind: 'changeset', id: page.select.changesetId } as const) : undefined;
      const lines = shown?.lines && shown.path === page.path ? { lines: shown.lines } : {};
      return { ...(object && { object }), page: { kind: page.view === 'annotate' ? 'annotate' : 'history', path: `/${page.path}` }, ...lines };
    }
    case 'browseRepository': {
      const path = shown?.path ?? page.focusPath;
      const lines = shown?.lines ? { lines: shown.lines } : {};
      return { object: { kind: 'changeset', id: page.changesetId }, page: { kind: 'browse', path: `/${path ?? ''}` }, ...lines };
    }
    case 'merge':
      return null;
  }
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
 * selected (`useSelectedLines`).
 */
export function shownFileOf(page: Page | undefined, onScreen: { target: DiffTarget; path: string } | null, selected: Required<ShownFile> | null): ShownFile | null {
  if (page?.kind === 'history' || page?.kind === 'browseRepository') return selected;
  if (!onScreen || (page?.kind !== 'diff' && page?.kind !== 'codeReview')) return null;
  if (page.kind === 'diff' && JSON.stringify(onScreen.target) !== JSON.stringify(page.target)) return null;
  return selected?.path === onScreen.path ? selected : { path: onScreen.path };
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
