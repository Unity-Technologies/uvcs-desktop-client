import { repositoryKey } from './repository';
import type { AppSettings } from './settings';
import type { RepositoryGuid } from './stableIds';

/** How many comments the check-in's Recent comments menu offers in a repository. */
export const MAX_RECENT_COMMENTS = 15;

/**
 * How many repositories keep their recent comments: those checked in to last. Enough for anyone's working set, and it
 * keeps the settings file from growing with every repository ever checked in to.
 */
export const MAX_RECENT_COMMENT_REPOSITORIES = 50;

export type RecentCommentSettings = Pick<AppSettings, 'recentComments' | 'recentCommentsByRepository'>;

/**
 * The comments the check-in offers in `repository` (its GUID), newest first: its own, from any of its workspaces.
 * Comments often name what only makes sense there (`cs:4207`, `br:/main/task`). A repository with none of its own yet
 * is offered those kept before they were per repository. Nothing while the repository's GUID isn't known.
 */
export function recentCommentsFor(settings: RecentCommentSettings, repository: RepositoryGuid | undefined): string[] {
  if (repository === undefined) return [];
  return settings.recentCommentsByRepository[repository] ?? settings.recentComments;
}

/** What the check-in's Recent comments menu offers (`recentCommentsOffer`). */
export interface RecentCommentsOffer {
  /** Whether its button shows. */
  offered: boolean;
  comments: string[];
  /** Shown in the menu, disabled, in place of the comments while they can't be offered: none once they can. */
  waiting: string | null;
}

/**
 * What the check-in's Recent comments menu offers in `repository` (its GUID): its comments once the GUID is known.
 * The GUID is read only as the menu opens (or once a check-in read it), so before that the button shows while any
 * comment is kept, and the menu says its comments are loading until the GUID comes, or that they couldn't be
 * (`unreadable`: the server out of reach, no repository by that name).
 */
export function recentCommentsOffer(settings: RecentCommentSettings, repository: RepositoryGuid | undefined, { unreadable = false } = {}): RecentCommentsOffer {
  if (repository !== undefined) {
    const comments = recentCommentsFor(settings, repository);
    return { offered: comments.length > 0, comments, waiting: null };
  }
  return {
    offered: settings.recentComments.length > 0 || Object.keys(settings.recentCommentsByRepository).length > 0,
    comments: [],
    waiting: unreadable ? "Couldn't load this repository's recent comments" : 'Loading…',
  };
}

/**
 * The settings change that puts `comment` first among `repository`'s recent comments, once. Its first check-in starts
 * its own list. The repository goes first, and only the `MAX_RECENT_COMMENT_REPOSITORIES` checked in to last are kept
 * (an object keeps its keys in the order they were added, through JSON too, except integer-like ones, which go first:
 * a GUID holds dashes, and a key kept before by spec the `@` before its server, so none is integer-like and none
 * reorders). The settings store applies it (`SettingsStore.rememberRecentComment`), so windows checking in to other
 * repositories meanwhile keep theirs.
 */
export function withRecentComment(settings: RecentCommentSettings, repository: RepositoryGuid, comment: string): Pick<AppSettings, 'recentCommentsByRepository'> {
  const key: string = repository;
  const { [key]: own = [], ...others } = settings.recentCommentsByRepository;
  const comments = [comment, ...own.filter((recent) => recent !== comment)].slice(0, MAX_RECENT_COMMENTS);
  const kept = Object.entries(others).slice(0, MAX_RECENT_COMMENT_REPOSITORIES - 1);
  return { recentCommentsByRepository: Object.fromEntries([[key, comments], ...kept]) };
}

/**
 * The recent comments kept by `spec` before (`repositoryKey`) moved under the repository's GUID, in the same place
 * among the repositories checked in to last; dropped when the GUID keeps its own. The same object when the spec kept
 * none.
 */
export function withRecentCommentsKeptByGuid(byRepository: Record<string, string[]>, spec: string, guid: RepositoryGuid): Record<string, string[]> {
  const key = repositoryKey(spec);
  if (!(key in byRepository)) return byRepository;
  const kept = guid in byRepository;
  return Object.fromEntries(
    Object.entries(byRepository).flatMap(([repository, comments]): [string, string[]][] => (repository !== key ? [[repository, comments]] : kept ? [] : [[guid, comments]])),
  );
}
