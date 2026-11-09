import type { IssueRead, IssueStatusCategory, IssueTrackerKind, TrackerConnection } from '@shared/domain/issueTrackers';
import { TRACKER_GRAMMARS } from '@shared/issueTrackers/trackerGrammars';
import type { ChipCard } from '../comments/chipContent';

/** An issue a comment names (`CommentReference`'s `issue`): its canonical key, and whether it was a bare `#12`. */
export interface IssueReference {
  key: string;
  bare: boolean;
}

/** How an issue reference shows: as the text it is, or a chip with its key, its title once read, its status's color. */
export type IssueChipShape =
  | { kind: 'text' }
  | {
      kind: 'chip';
      /** The key as written (`VCS-12`, `#12`, `Acme/Game#12`); an address's, its key. */
      label: string;
      /** In words, for the tooltip and screen readers: "Jira issue VCS-12". */
      title: string;
      /** The issue's title, beside the key in a full comment. */
      summary?: string;
      category?: IssueStatusCategory;
    };

/**
 * Whether a reference is a chip (docs/features/issue-trackers.md, "A missing issue"): a key or `owner/repo#12` always,
 * a missing one too, as `cs:` is; a bare `#12` only once read as found, never in a row, where nothing reads it.
 */
export function issueChipShape(reference: IssueReference, source: string, kind: IssueTrackerKind, read: IssueRead | undefined, compact: boolean): IssueChipShape {
  if (reference.bare && (compact || read?.kind !== 'found')) return { kind: 'text' };
  const found = read?.kind === 'found' ? read.issue : undefined;
  return {
    kind: 'chip',
    label: chipLabel(reference, source, kind),
    title: `${issueNoun(kind, found?.type)} ${reference.key}`,
    ...(found && !compact && { summary: found.title }),
    ...(found && { category: found.statusCategory }),
  };
}

/** "Jira issue", "GitHub issue", "Pull request". */
function issueNoun(kind: IssueTrackerKind, type: string | undefined): string {
  return type === 'Pull request' ? 'Pull request' : `${TRACKER_GRAMMARS[kind].name} issue`;
}

/** Where a click on an issue's chip leads: the issue's own page as the tracker gave it, else the one its key names. */
export function issueUrlToOpen(read: IssueRead | undefined, key: string, urlOfKey: (key: string) => string): string {
  return read?.kind === 'found' ? read.issue.url : urlOfKey(key);
}

/**
 * A chip's card: the issue's title first, then its status, type and assignee; or, unread, why ("Sign in to Jira again
 * to see it", "No issue VCS-12"), so a chip is never silent about what it can't show.
 */
export function issueCard(reference: IssueReference, connection: Pick<TrackerConnection, 'kind' | 'credential'>, read: IssueRead | undefined): ChipCard {
  const tracker = TRACKER_GRAMMARS[connection.kind].name;
  const title = `${issueNoun(connection.kind, read?.kind === 'found' ? read.issue.type : undefined)} ${reference.key}`;
  if (connection.credential === 'refused' || connection.credential === 'missing') return { title, meta: [`Sign in to ${tracker} again to see it`] };
  switch (read?.kind) {
    case 'found': {
      const { issue } = read;
      return { comment: issue.title, title, meta: [title, issue.status, ...(issue.type && issue.type !== 'Issue' && issue.type !== 'Pull request' ? [issue.type] : []), issue.assignee ? issue.assignee.name : 'Unassigned'] };
    }
    case 'missing':
      return { title, meta: [`No issue ${reference.key}`] };
    case 'noAccess':
      return { title, meta: [`Your ${tracker} sign-in can't see it`] };
    case 'unreadable':
      return { title, meta: [unreadableWords(tracker, connection.kind, read.reason)] };
    case undefined:
      return { title, meta: [] };
  }
}

function unreadableWords(tracker: string, kind: IssueTrackerKind, reason: Extract<IssueRead, { kind: 'unreadable' }>['reason']): string {
  switch (reason) {
    case 'noAccess':
      // The tracker refused the read itself (a 403), not one issue: the credential can't read issues at all.
      return `Your ${tracker} ${kind === 'github' ? 'sign-in' : 'token'} can't read issues`;
    case 'signInRefused':
      return `Sign in to ${tracker} again to see it`;
    case 'rateLimited':
      return `${tracker} asked to wait: it shows again in a while`;
    case 'unreachable':
      return `${tracker} couldn't be reached`;
    default:
      return `Couldn't read it from ${tracker}`;
  }
}

/**
 * What a chip names its issue by. A Jira issue by its key: written as its address (the address is what copying gives
 * back) or with the `#` it was typed with (`#VCS-12`), as a mention's chip drops its `@` and a changeset's its `cs:`.
 * A GitHub one as written (`#12`, `owner/repo#12`), the `#` being part of how GitHub names it, its address by its key.
 */
function chipLabel(reference: IssueReference, source: string, kind: IssueTrackerKind): string {
  if (kind !== 'github' || /^<?https?:\/\//i.test(source)) return reference.key;
  return source;
}
