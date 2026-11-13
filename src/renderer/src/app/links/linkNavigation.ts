import type { ReviewConversation } from '@shared/domain/reviewConversation';
import type { LinkLines, LinkObject, LinkPage, LinkView } from '@shared/links/link';
import type { RevealTarget } from '../../features/branchExplorer/model/revealTarget';
import { branchDiffPage } from '../../features/branches/branchOperations';
import { changesetDiffPage, rangeDiffPage } from '../../features/changesets/changesetOperations';
import { codeReviewPage } from '../../features/codeReviews/codeReviewOperations';
import { commentLinkPage } from '../../features/codeReviews/conversation/commentLink';
import { labelDiffPage, labelRangeDiffPage } from '../../features/labels/labelOperations';
import { shelveDiffPage } from '../../features/shelves/shelveOperations';
import type { Page } from '../navigation/pages';
import type { ViewId } from '../navigation/views';

/** What a link opens once its workspace is known: an object, a page in it, lines. Paths are the repository's (`/a.cs`). */
export interface LinkTarget {
  object?: LinkObject;
  page?: LinkPage;
  lines?: LinkLines;
}

/**
 * What a link's page needs read first: a label's changeset, a branch's head to browse (/main's for a repository's), a
 * review's conversation to find a comment in (the read the review's page makes, so the page reads it no more).
 */
export type LinkLookup = { kind: 'label'; name: string } | { kind: 'branchHead'; name: string } | { kind: 'reviewConversation'; reviewId: number } | null;

/**
 * What was read for a link's lookup: the changeset its label is on, or its branch's head; a review's conversation, null
 * when it couldn't be read (the review's page says why).
 */
export type LinkLooked = { changesetId: number } | { conversation: ReviewConversation | null };

/**
 * Where a link goes: a view, an item shown in it (revealed in Files, selected in Changes, the object in the Branch
 * Explorer), or a page over the view.
 */
export type LinkNavigation =
  | { kind: 'view'; view: ViewId; show?: ShownInView }
  | { kind: 'page'; page: Page; notice?: LinkNotice };

/** What the app says, in a toast, as a link opens what it names gone: a review's comment deleted since. */
export interface LinkNotice {
  title: string;
  description: string;
}

export type ShownInView =
  | { kind: 'files'; path: string }
  | { kind: 'change'; path: string; lines?: LinkLines }
  | { kind: 'branchExplorer'; target: RevealTarget };

/** The view each link view names (docs/features/deep-links.md). */
export const LINK_VIEW_IDS: Record<LinkView, ViewId> = {
  changes: 'changes',
  incoming: 'incoming',
  files: 'files',
  changesets: 'changesets',
  'branch-explorer': 'branchExplorer',
  branches: 'branches',
  labels: 'labels',
  shelves: 'shelves',
  attributes: 'attributes',
  'code-reviews': 'codeReviews',
  locks: 'locks',
  sync: 'sync',
};

export function linkLookup({ object, page }: LinkTarget): LinkLookup {
  if (object?.kind === 'label') return { kind: 'label', name: object.name };
  if (object?.kind === 'codeReview' && page?.kind === 'reviewComment') return { kind: 'reviewConversation', reviewId: object.id };
  if (page?.kind === 'browse' && (object === undefined || object.kind === 'branch')) return { kind: 'branchHead', name: object?.name ?? '/main' };
  return null;
}

/** Where a link goes, given what its lookup read (`linkLookup`): null when it needs none. */
export function linkNavigation(target: LinkTarget, looked: LinkLooked | null): LinkNavigation {
  const { object, page, lines } = target;
  if (!object) return placeNavigation(page, lines, looked);
  if (object.kind === 'codeReview' && page?.kind === 'reviewComment') return reviewCommentNavigation(object.id, page.commentId, looked);
  const revealed = page?.kind === 'view' && revealTargetOf(object, looked);
  if (revealed) return { kind: 'view', view: 'branchExplorer', show: { kind: 'branchExplorer', target: revealed } };
  if (page?.kind === 'browse' || page?.kind === 'history' || page?.kind === 'annotate') return itemPage(page, lines, pointOf(object, looked));
  const focusPath = page?.kind === 'diffFile' ? workspaceRelative(page.path) : undefined;
  const focus = focusPath === undefined ? {} : lines ? { focusPath, focusLines: lines } : { focusPath };
  return { kind: 'page', page: { ...objectPage(object, looked), ...focus } };
}

/** A review at a comment (`commentLinkPage`), from its conversation read; the review alone when it couldn't be. */
function reviewCommentNavigation(reviewId: number, commentId: number, looked: LinkLooked | null): LinkNavigation {
  if (!looked || !('conversation' in looked)) throw new Error("A link's lookup must be read before it opens.");
  if (!looked.conversation) return { kind: 'page', page: codeReviewPage({ id: reviewId }) };
  const { page, found } = commentLinkPage(reviewId, commentId, looked.conversation);
  if (found) return { kind: 'page', page };
  return { kind: 'page', page, notice: { title: 'Comment not found', description: `Code review ${reviewId} has no such comment. It may have been deleted.` } };
}

/** A repository's or a workspace's own page: a view, an item revealed or selected in it, or an item's page. */
function placeNavigation(page: LinkPage | undefined, lines: LinkLines | undefined, looked: LinkLooked | null): LinkNavigation {
  if (!page) return { kind: 'view', view: 'changes' };
  if (page.kind === 'view') {
    const view = LINK_VIEW_IDS[page.view];
    if (page.path === undefined) return { kind: 'view', view };
    const path = workspaceRelative(page.path);
    if (page.view === 'changes') return { kind: 'view', view, show: lines ? { kind: 'change', path, lines } : { kind: 'change', path } };
    return { kind: 'view', view, show: { kind: 'files', path } };
  }
  if (page.kind === 'diffFile') return { kind: 'view', view: 'changes', show: { kind: 'change', path: workspaceRelative(page.path) } };
  // Only a review has comments: `parseLink` reads none after a repository or a workspace.
  if (page.kind === 'reviewComment') throw new Error('A link names a comment only after its review.');
  return itemPage(page, lines, page.kind === 'browse' ? lookedChangeset(looked) : null);
}

/** The changeset an item's page is at: a changeset's, a label's or a browsed branch's head; none for a branch's latest. */
function pointOf(object: LinkObject, looked: LinkLooked | null): number | null {
  if (object.kind === 'changeset') return object.id;
  if (object.kind === 'label') return lookedChangeset(looked);
  // A branch: its head read to browse it; its latest for a history.
  return looked && 'changesetId' in looked ? looked.changesetId : null;
}

function lookedChangeset(looked: LinkLooked | null): number {
  if (!looked || !('changesetId' in looked)) throw new Error("A link's lookup must be read before it opens.");
  return looked.changesetId;
}

function itemPage(page: Extract<LinkPage, { kind: 'browse' | 'history' | 'annotate' }>, lines: LinkLines | undefined, changesetId: number | null): LinkNavigation {
  const path = workspaceRelative(page.path);
  const focusLines = lines ? { focusLines: lines } : {};
  if (page.kind === 'browse') {
    const focusPath = path ? { focusPath: path } : {};
    return { kind: 'page', page: { kind: 'browseRepository', changesetId: changesetId!, ...focusPath, ...focusLines } };
  }
  const select = changesetId === null ? {} : { select: { changesetId } };
  const view = page.kind === 'annotate' ? { view: 'annotate' as const } : {};
  return { kind: 'page', page: { kind: 'history', path, ...select, ...view, ...focusLines } };
}

function objectPage(object: LinkObject, looked: LinkLooked | null): Page {
  switch (object.kind) {
    case 'changeset':
      return changesetDiffPage({ id: object.id });
    case 'changesetRange':
      return rangeDiffPage(object.from, object.to);
    case 'branch':
      return branchDiffPage({ name: object.name });
    case 'label':
      return labelDiffPage({ name: object.name, changeset: lookedChangeset(looked) });
    case 'labelRange':
      return labelRangeDiffPage(object.from, object.to);
    case 'shelve':
      return shelveDiffPage({ id: object.id });
    case 'codeReview':
      return codeReviewPage({ id: object.id });
  }
}

/** What the Branch Explorer shows for an object; null for one it doesn't (a range, a shelve, a review: their diff opens). */
function revealTargetOf(object: LinkObject, looked: LinkLooked | null): RevealTarget | null {
  switch (object.kind) {
    case 'changeset':
      return { kind: 'changeset', id: object.id };
    case 'branch':
      return { kind: 'branch', name: object.name };
    case 'label':
      return { kind: 'label', name: object.name, changeset: lookedChangeset(looked) };
    default:
      return null;
  }
}

/** A link's repository path as the app's pages name items: relative, no leading slash (`/Assets/a.cs` → `Assets/a.cs`). */
function workspaceRelative(path: string): string {
  return path.replace(/^\/+/, '');
}
