import { repositoryKey } from './repository';
import type { AppSettings } from './settings';

/** How many comments the check-in's Recent comments menu offers in a repository. */
export const MAX_RECENT_COMMENTS = 15;

/**
 * How many repositories keep their recent comments: those checked in to last. Enough for anyone's working set, and it
 * keeps the settings file from growing with every repository ever checked in to.
 */
export const MAX_RECENT_COMMENT_REPOSITORIES = 50;

export type RecentCommentSettings = Pick<AppSettings, 'recentComments' | 'recentCommentsByRepository'>;

/**
 * The comments the check-in offers in `repository` (a spec, `name@server`), newest first: its own, from any of its
 * workspaces. Comments often name what only makes sense there (`cs:4207`, `br:/main/task`). A repository with none
 * of its own yet is offered those kept before they were per repository. Nothing while the repository isn't known.
 */
export function recentCommentsFor(settings: RecentCommentSettings, repository: string | undefined): string[] {
  if (repository === undefined) return [];
  return settings.recentCommentsByRepository[repositoryKey(repository)] ?? settings.recentComments;
}

/**
 * The settings change that puts `comment` first among `repository`'s recent comments, once. Its first check-in starts
 * its own list. The repository goes first, and only the `MAX_RECENT_COMMENT_REPOSITORIES` checked in to last are kept
 * (an object keeps its string keys in the order they were added, through JSON too).
 */
export function withRecentComment(settings: RecentCommentSettings, repository: string, comment: string): Pick<AppSettings, 'recentCommentsByRepository'> {
  const key = repositoryKey(repository);
  const { [key]: own = [], ...others } = settings.recentCommentsByRepository;
  const comments = [comment, ...own.filter((recent) => recent !== comment)].slice(0, MAX_RECENT_COMMENTS);
  const kept = Object.entries(others).slice(0, MAX_RECENT_COMMENT_REPOSITORIES - 1);
  return { recentCommentsByRepository: Object.fromEntries([[key, comments], ...kept]) };
}
