import type { DiffTarget } from '@shared/domain/diff';
import { shortBranchName } from '@shared/domain/specs';
import type { LinkLines, LinkObject } from '@shared/links/link';
import type { ShownBrowseItem } from '../../features/browseRepository/shownBrowseItem';
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
 * What a page's own link names, its header's "Copy link" (`CopyLinkButton`): the object it is about, never the file or
 * lines it shows (those are the line chip's, its menu's and a file's Copy ▸ Link). A diff's or review's object (a
 * label's diff, its label); a history's item at the revision shown; a browse's changeset at the item shown. Null for a
 * page no link names.
 */
export function pageObjectTarget(page: Page, shown: ShownFile | null): LinkTarget | null {
  const target = pageObjectTargetOf(page, shown);
  return target && isWritable(target) ? target : null;
}

function pageObjectTargetOf(page: Page, shown: ShownFile | null): LinkTarget | null {
  switch (page.kind) {
    case 'diff': {
      const object = page.label !== undefined ? ({ kind: 'label', name: page.label } as const) : diffTargetObject(page.target);
      return object && { object };
    }
    case 'codeReview':
      return { object: { kind: 'codeReview', id: page.reviewId } };
    case 'history': {
      const target = historyLinkTarget(page, shown);
      return target && { ...(target.object && { object: target.object }), page: { kind: 'history', path: `/${page.path}` } };
    }
    case 'browseRepository': {
      const path = shown?.path ?? page.focusPath;
      return { object: { kind: 'changeset', id: page.changesetId }, page: { kind: 'browse', path: `/${path ?? ''}` } };
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
  browsed: ShownBrowseItem | null = null,
): ShownFile | null {
  // Lines selected count only in the file the page shows: a view under the page (Files) may have selected others.
  const linesIn = (path: string): Pick<ShownFile, 'lines'> => (selected?.path === path ? { lines: selected.lines } : {});
  if (page?.kind === 'history' && revision?.path === page.path) return { path: page.path, ...linesIn(page.path), revision };
  if (page?.kind === 'history') return selected?.path === page.path ? selected : null;
  if (page?.kind === 'browseRepository') {
    if (browsed?.changesetId !== page.changesetId) return null;
    // A browse link's lines are the item's as it was there: an older side's (its diff of the last change) have no link.
    const lines = selected?.path === browsed.path && selected.lines.side === 'new' ? { lines: selected.lines } : {};
    return { path: browsed.path, ...lines };
  }
  if (!onScreen || (page?.kind !== 'diff' && page?.kind !== 'codeReview')) return null;
  if (page.kind === 'diff' && JSON.stringify(onScreen.target) !== JSON.stringify(page.target)) return null;
  return selected?.path === onScreen.path ? selected : { path: onScreen.path };
}

/** The link to a viewer's own selected lines where no page names them (the Files view: `LineLinks.linkOf`). */
export function placeLinesTarget(publishes: boolean, linkOf: (lines: LinkLines) => LinkTarget | null, lines: LinkLines | null): LinkTarget | null {
  return publishes && lines ? linkOf(lines) : null;
}

/** What "Copy link" copies (`useCopyLinkCommand`): a link it names, or the one the view's selected object offers. */
export type LinkToCopy = { kind: 'target'; target: LinkTarget } | { kind: 'selectedObject' } | null;

/**
 * What "Copy link" copies, as a browser's address bar would: the lines selected in the page in front, else the page's
 * own object, else the object selected in the view, else the view itself; nothing for a page or view no link names.
 */
export function linkToCopy({ top, shown, hasSelectedObject, view }: { top: Page | undefined; shown: ShownFile | null; hasSelectedObject: boolean; view: ViewId }): LinkToCopy {
  const target = top ? pageLinkToCopy(top, shown) : hasSelectedObject ? null : viewLinkTarget(view);
  if (target) return { kind: 'target', target };
  return !top && hasSelectedObject ? { kind: 'selectedObject' } : null;
}

/** A page's link "Copy link" copies: the lines selected in it when some are (as their chip), else its own (as its header). */
function pageLinkToCopy(page: Page, shown: ShownFile | null): LinkTarget | null {
  return shown?.lines ? pageLinkTarget(page, shown) : pageObjectTarget(page, shown);
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

/**
 * What a page's header "Copy link" says it copies (`pageObjectTarget`): "Copy link to changeset 28", "… to branch
 * fuzzy", "… to history of Player.cs", "… to Player.cs at changeset 7".
 */
export function objectLinkLabel(target: LinkTarget | null): string {
  if (!target) return 'Copy link';
  const path = target.page && 'path' in target.page ? target.page.path : undefined;
  const name = path && path !== '/' ? path.split('/').at(-1) : undefined;
  if (target.page?.kind === 'history' && name) return `Copy link to history of ${name}`;
  const object = target.object && objectWords(target.object);
  if (name && object) return `Copy link to ${name} at ${object}`;
  return object ? `Copy link to ${object}` : 'Copy link';
}

function objectWords(object: LinkObject): string {
  switch (object.kind) {
    case 'changeset':
      return `changeset ${object.id}`;
    case 'changesetRange':
      return `changesets ${object.from + 1}–${object.to}`;
    case 'branch':
      return `branch ${shortBranchName(object.name)}`;
    case 'label':
      return `label ${object.name}`;
    case 'labelRange':
      return `labels ${object.from}–${object.to}`;
    case 'shelve':
      return `shelve ${object.id}`;
    case 'codeReview':
      return `${object.asMergeRequest ? 'merge request' : 'code review'} ${object.id}`;
  }
}

/** What "Copy link" says it copies, in its tooltip: "Copy link to lines 40–52 of Player.cs". */
export function copyLinkLabel(target: LinkTarget | null): string {
  const path = target?.page && 'path' in target.page ? target.page.path : undefined;
  const name = path && path !== '/' ? path.split('/').at(-1) : undefined;
  if (!target?.lines || !name) return name ? `Copy link to ${name}` : 'Copy link';
  const { first, last } = target.lines;
  return first === last ? `Copy link to line ${first} of ${name}` : `Copy link to lines ${first}–${last} of ${name}`;
}

/** What the toast adds once a link was copied another way than the shortcut, to teach it: "⇧⌘C copies it next time". */
export function nextTimeHint(shortcutKeys: readonly string[]): string {
  return `${shortcutKeys.join('')} copies it next time`;
}
