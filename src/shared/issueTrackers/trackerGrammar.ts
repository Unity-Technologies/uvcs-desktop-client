import type { IssueTrackerKind } from '../domain/issueTrackers';

/**
 * A link read back as a tracker's: its kind, server, project, and the issue it names. `issuePage` is the issue's own
 * page; `issueInView` an issue shown in another view (a Jira board's `?selectedIssue=`), which Connect takes as a
 * sample but a comment never takes as the issue.
 */
export interface RecognizedLink {
  kind: IssueTrackerKind;
  server: string;
  /** Jira's project key (`VCS`), GitHub's repository (`acme/game`, lower case). */
  project: string;
  /** Canonical: `VCS-12`, `acme/game#12`. */
  key: string;
  shows: 'issuePage' | 'issueInView';
}

/** A link of a tracker the app knows that names no issue: what it is instead, in words ("a Jira board"). */
export interface NotAnIssueLink {
  kind: IssueTrackerKind;
  notAnIssue: string;
}

/** An issue reference found in a comment's text, and where. `bare`: GitHub's `#12`, read only for one repository. */
export interface FoundIssueReference {
  key: string;
  bare: boolean;
  source: string;
  from: number;
  to: number;
}

/** A pasted token: of a shape this tracker issues (`known`), only plausible (length and characters), or not a token. */
export type TokenShape = 'known' | 'plausible' | 'none';

/** What a tracker's text looks like, with no network (docs/features/issue-trackers.md, "The grammar"). */
export interface TrackerGrammar {
  kind: IssueTrackerKind;
  /** The tracker's name in words: "Jira", "GitHub". */
  name: string;
  /** Null when the link isn't this tracker's. */
  recognize(url: URL): RecognizedLink | NotAnIssueLink | null;
  /** The issue references `text` holds for these projects (Jira keys, GitHub `#12` and `owner/repo#12`). */
  referencesIn(text: string, projects: readonly string[]): FoundIssueReference[];
  /** The issue's page, which a chip opens. */
  issueUrl(server: string, key: string): string;
  /** Where a token is made, filled in where the tracker allows it. */
  tokenPageUrl(server: string): string;
  tokenShape(token: string): TokenShape;
}

/**
 * A Jira key's or GitHub number's start: never after a letter or a digit, a path, an address, an entity (`&#123;`) or a
 * time; after an emphasis mark (`_VCS-12_`) it may.
 */
export const REFERENCE_START = String.raw`(?<![\p{L}\p{N}/@:.#\\&-])`;

/**
 * A reference's end: no word character follows. An underscore after it ends it only when no word follows it, so an
 * emphasis mark (`_VCS-12_`) ends the reference and `VCS-12_fix` holds none.
 */
export const REFERENCE_END = String.raw`(?![\p{L}\p{N}]|_[\p{L}\p{N}])`;

/** A token's characters and length when its shape isn't known: no spaces, nothing a token never holds. */
const PLAUSIBLE_TOKEN = /^[A-Za-z0-9_\-=.+/]{16,512}$/;

export function isPlausibleToken(token: string): boolean {
  return PLAUSIBLE_TOKEN.test(token);
}
