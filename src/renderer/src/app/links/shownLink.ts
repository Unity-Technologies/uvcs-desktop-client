import type { LinkLines } from '@shared/links/link';
import type { Page } from '../navigation/pages';
import type { ViewId } from '../navigation/views';
import { LINK_VIEW_IDS, type LinkTarget } from './linkNavigation';
import { diffTargetObject } from './linkTo';

/** Lines selected in the page in front, and the file they're in (a repository path, as `DiffEntry.path`). */
export interface SelectedLines {
  path: string;
  lines: LinkLines;
}

/**
 * What a link to the page in front names, as a browser's address bar would (docs/features/deep-links.md, "Where links
 * are copied"): the object a diff or a review shows, the file shown or the lines selected in it, the item a history or
 * a browse shows. Null for a page no link names (a merge, a diff of two branches' heads).
 */
export function pageLinkTarget(page: Page, selected: SelectedLines | null): LinkTarget | null {
  switch (page.kind) {
    case 'diff': {
      const object = diffTargetObject(page.target);
      return object && { object, ...fileIn(page.focusPath, selected) };
    }
    case 'codeReview':
      return { object: { kind: 'codeReview', id: page.reviewId }, ...fileIn(page.focusPath, selected) };
    case 'history': {
      const object = page.select && 'changesetId' in page.select ? ({ kind: 'changeset', id: page.select.changesetId } as const) : undefined;
      const lines = selected?.path === page.path ? { lines: selected.lines } : {};
      return { ...(object && { object }), page: { kind: page.view === 'annotate' ? 'annotate' : 'history', path: `/${page.path}` }, ...lines };
    }
    case 'browseRepository': {
      const path = selected?.path ?? page.focusPath;
      const lines = selected ? { lines: selected.lines } : {};
      return { object: { kind: 'changeset', id: page.changesetId }, page: { kind: 'browse', path: `/${path ?? ''}` }, ...lines };
    }
    case 'merge':
      return null;
  }
}

/** The file a diff shows, and its selected lines: those the user selected, else the file it opened on. */
function fileIn(focusPath: string | undefined, selected: SelectedLines | null): Pick<LinkTarget, 'page' | 'lines'> {
  if (selected) return { page: { kind: 'diffFile', path: `/${selected.path}` }, lines: selected.lines };
  return focusPath ? { page: { kind: 'diffFile', path: `/${focusPath}` } } : {};
}

/** What a link to a view with nothing selected names: the view, in the workspace's repository. */
export function viewLinkTarget(view: ViewId): LinkTarget {
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
