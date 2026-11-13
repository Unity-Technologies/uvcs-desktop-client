import { nameToEmoji } from 'gemoji';
import type { IssueReferenceReader } from '@shared/issueTrackers/issueReferences';
import type { RepositoryLink } from '@shared/links/link';
import { isAppLink, parseLink } from '@shared/links/parseLink';

/**
 * Where a file reference points: the changeset, branch, label or shelve after `#` in `serverpath:/a.cs#cs:12`.
 */
export type ReferencePoint =
  | { kind: 'changeset'; id: number }
  | { kind: 'branch'; name: string }
  | { kind: 'label'; name: string }
  | { kind: 'shelve'; id: number };

/**
 * What a comment names in its text (docs/features/rich-comments.md, "References"). The objects are written as `cm`
 * takes them, `repository` being what follows their first `@` (`game@acme@unity`, or `game` on the place's server);
 * a code review, which `cm` names by number only, as `cr:311`; people as `@name`, emoji by GitHub's names.
 */
export type CommentReference =
  | { kind: 'changeset'; id: number; repository?: string }
  | { kind: 'branch'; name: string; repository?: string }
  | { kind: 'label'; name: string; repository?: string }
  | { kind: 'shelve'; id: number; repository?: string }
  | { kind: 'codeReview'; id: number; repository?: string }
  | { kind: 'file'; path: string; at: ReferencePoint; repository?: string }
  | { kind: 'user'; name: string }
  | { kind: 'emoji'; name: string; glyph: string }
  /**
   * A change request of a code review a check-in applies, as `cm` reads it in a changeset's comment
   * (`[apply-change:c0d1ce00]`): its guid's first eight hex digits, or the whole guid, lower case.
   */
  | { kind: 'changeRequest'; guid: string }
  /** A `uvcs://` link (or the official client's `plastic://` one) to a repository's object or page (docs/features/deep-links.md). */
  | { kind: 'link'; link: RepositoryLink }
  /**
   * An issue of the place's tracker (docs/features/issue-trackers.md): its canonical key; `bare` for GitHub's `#12`,
   * which shows as a chip only once read as found.
   */
  | { kind: 'issue'; key: string; bare: boolean };

export interface FoundReference {
  reference: CommentReference;
  /** The text as written, which copying gives back. */
  source: string;
  from: number;
  to: number;
}

/**
 * Where a reference may start: anything that can only be one, after a space, a line's start, an opening bracket or an
 * emphasis mark (`_cs:12_`), never inside a word, a path, an address or a time (`ana@acme.com`, `/a/cs:1`,
 * `10:30:00`). Letters and digits of any script count as a word's (`josé@acme.com`).
 * The app's links read in any case, as `isAppLink` reads them, spelled out letter by letter: the engine of the Node
 * the app builds with (22) has no regex modifier for case.
 */
const CANDIDATE = /(?<![\p{L}\p{N}/@:.#\\-])(?:(?:cs|br|lb|sh|cr):\S+|serverpath:\/\S*|[uU][vV][cC][sS]:\/\/\S+|[pP][lL][aA][sS][tT][iI][cC]:\/\/\S+|@[\p{L}\p{N}_\\]\S*|:[a-z0-9_+-]+:)/gu;

/**
 * What ends a sentence, a bracket or an emphasis rather than a name: `cm` reads none of it as the end of a spec (it
 * has no quoting, and a branch's or label's name may hold almost anything), so a comment's `see cs:12.`,
 * `(br:/main)` or `**cs:12**` is read as people mean it. A name that itself ends in one of these (`br:/main/task_`)
 * is written as its `uvcs://` link.
 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"*_~]+$/;

/** A person as `cm` names them, in any script: a name, `DOMAIN\name`, or an email address (Unity Cloud). */
const MENTION = /^@([\p{L}\p{N}_\\][\p{L}\p{N}_.+\\-]*(?:@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)?)/u;

/**
 * A change request a changeset applies, as `cm checkin` and `cm changeset editcomment` find it in the comment: the first
 * eight hex digits of its guid, or the whole guid, between `[apply-change:` and `]`, in any case and anywhere, even
 * inside a word, as `cm` reads it. The case-insensitive flag is the global expression's own (no modifier needed).
 */
const APPLY_CHANGE = /\[apply-change:([0-9a-f]{8}(?:-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?)\]/gi;

/** The text a check-in comment holds to apply a change request (`[apply-change:c0d1ce00]`), by its guid's first eight digits. */
export function applyChangeText(guid: string): string {
  return `[apply-change:${shortGuid(guid)}]`;
}

/** A guid's first eight hex digits, lower case: how a comment names a change request (`applyChangeText`). */
export function shortGuid(guid: string): string {
  return guid.slice(0, 8).toLowerCase();
}

// Its own expression: `test` on the global one would leave a `lastIndex` that `matchAll` in `findReferences` copies.
const ANY_CANDIDATE = new RegExp(CANDIDATE.source, 'u');

/** Whether a text may hold a reference, without reading any: a quick test before parsing. */
export function mayHoldReference(text: string): boolean {
  return ANY_CANDIDATE.test(text) || ANY_APPLY_CHANGE.test(text);
}

const ANY_APPLY_CHANGE = new RegExp(APPLY_CHANGE.source, 'i');

const WHOLE_APPLY_CHANGE = new RegExp(`^${APPLY_CHANGE.source}$`, 'i');

/**
 * Whether a text is a change request to apply and nothing else (`[apply-change:c0d1ce00]`): the editor's Markdown
 * reader takes its brackets for a link's (a shortcut reference, `[text]`), which would hold the reference out.
 */
export function isChangeRequestReference(text: string): boolean {
  return WHOLE_APPLY_CHANGE.test(text);
}

/**
 * Every reference in a text, in order. Code and links are the caller's to leave out (`parseMarkdown`). With the
 * place's tracker (`issues`), its issue keys too, where no other reference already reads the text (`br:/main/VCS-12`).
 */
export function findReferences(text: string, issues?: IssueReferenceReader): FoundReference[] {
  const found: FoundReference[] = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const read = readCandidate(match[0]);
    if (read) found.push({ reference: read.reference, source: read.source, from: match.index, to: match.index + read.source.length });
  }
  const withRequests = withChangeRequests(text, found);
  if (!issues) return withRequests;
  const keys = issues
    .referencesIn(text)
    .filter((issue) => !withRequests.some((other) => issue.from < other.to && issue.to > other.from))
    .map(({ key, bare, source, from, to }): FoundReference => ({ reference: { kind: 'issue', key, bare }, source, from, to }));
  return keys.length === 0 ? withRequests : [...withRequests, ...keys].sort((a, b) => a.from - b.from);
}

/** The change requests to apply among the other references (`APPLY_CHANGE`), in order; nothing else read inside one. */
function withChangeRequests(text: string, found: FoundReference[]): FoundReference[] {
  const requests = [...text.matchAll(APPLY_CHANGE)].map(
    (match): FoundReference => ({ reference: { kind: 'changeRequest', guid: match[1]!.toLowerCase() }, source: match[0], from: match.index, to: match.index + match[0].length }),
  );
  if (requests.length === 0) return found;
  const outside = found.filter((other) => !requests.some((request) => other.from < request.to && other.to > request.from));
  return [...outside, ...requests].sort((a, b) => a.from - b.from);
}

function readCandidate(candidate: string): { reference: CommentReference; source: string } | null {
  if (candidate.startsWith('@')) return readMention(candidate);
  if (candidate.startsWith(':')) return readEmoji(candidate);
  const source = candidate.replace(TRAILING_PUNCTUATION, '');
  const reference = isAppLink(source) ? readLink(source) : readSpec(source);
  return reference && { reference, source };
}

function readMention(candidate: string): { reference: CommentReference; source: string } | null {
  const name = MENTION.exec(candidate)?.[1]?.replace(/[._-]+$/, '');
  return name ? { reference: { kind: 'user', name }, source: `@${name}` } : null;
}

function readEmoji(candidate: string): { reference: CommentReference; source: string } | null {
  const name = candidate.slice(1, -1);
  const glyph = nameToEmoji[name];
  return glyph ? { reference: { kind: 'emoji', name, glyph }, source: candidate } : null;
}

function readLink(source: string): CommentReference | null {
  const reading = parseLink(source);
  return 'link' in reading && reading.link.kind === 'repository' ? { kind: 'link', link: reading.link } : null;
}

/** A spec as `cm` reads it: the body up to the first `@`, then the repository (`rep:` and `repserver:` dropped). */
function readSpec(source: string): CommentReference | null {
  const at = source.indexOf('@');
  const body = at < 0 ? source : source.slice(0, at);
  const repository = at < 0 ? undefined : repositoryOf(source.slice(at + 1));
  if (repository === null) return null;
  const object = body.startsWith('serverpath:') ? readFile(body.slice('serverpath:'.length)) : readObject(body);
  return object && (repository ? { ...object, repository } : object);
}

function repositoryOf(suffix: string): string | null | undefined {
  const repository = suffix.replace(/^rep:/, '').replace(/@repserver:/, '@');
  return repository && !repository.startsWith('@') && !repository.endsWith('@') ? repository : null;
}

type ObjectReference = Extract<CommentReference, { kind: 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' }>;

function readObject(body: string): ObjectReference | null {
  const prefix = body.slice(0, 3);
  const value = body.slice(3);
  if (!value) return null;
  switch (prefix) {
    case 'cs:':
      return /^\d+$/.test(value) ? { kind: 'changeset', id: Number(value) } : null;
    case 'sh:':
      return /^\d+$/.test(value) ? { kind: 'shelve', id: Number(value) } : null;
    case 'cr:':
      return /^\d+$/.test(value) ? { kind: 'codeReview', id: Number(value) } : null;
    case 'br:':
      // `cm` adds the leading slash a branch's name may be written without.
      return value === '/' ? null : { kind: 'branch', name: value.startsWith('/') ? value : `/${value}` };
    case 'lb:':
      return { kind: 'label', name: value };
  }
  return null;
}

/** `/path#cs:12`: a repository path at a changeset, branch, label or shelve, as `cm` takes after `serverpath:`. */
function readFile(body: string): Extract<CommentReference, { kind: 'file' }> | null {
  const hash = body.search(/#(cs|br|lb|sh):/);
  if (hash <= 0) return null;
  const path = body.slice(0, hash);
  const point = readObject(body.slice(hash + 1));
  if (!path.startsWith('/') || !point || point.kind === 'codeReview') return null;
  return { kind: 'file', path, at: point };
}
