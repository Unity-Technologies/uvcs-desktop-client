import { nameToEmoji } from 'gemoji';
import type { RepositoryLink } from '@shared/links/link';
import { parseLink } from '@shared/links/parseLink';

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
  /** A `uvcs://` link to a repository's object or page (docs/features/deep-links.md). */
  | { kind: 'link'; link: RepositoryLink };

export interface FoundReference {
  reference: CommentReference;
  /** The text as written, which copying gives back. */
  source: string;
  from: number;
  to: number;
}

/**
 * Where a reference may start: anything that can only be one, after a space, a line's start or an opening bracket,
 * never inside a word, a path, an address or a time (`ana@acme.com`, `/a/cs:1`, `10:30:00`).
 */
const CANDIDATE = /(?<![\w/@:.#\\-])(?:(?:cs|br|lb|sh|cr):\S+|serverpath:\/\S*|uvcs:\/\/\S+|@[\w\\]\S*|:[a-z0-9_+-]+:)/g;

/**
 * What ends a sentence or a bracket rather than a name: `cm` reads none of it as the end of a spec (it has no
 * quoting, and a branch's or label's name may hold almost anything), so a comment's `see cs:12.` or `(br:/main)` is
 * read as people mean it.
 */
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"]+$/;

/** A person as `cm` names them: a name, `DOMAIN\name`, or an email address (Unity Cloud). */
const MENTION = /^@([\w\\][\w.+\\-]*(?:@[\w-]+(?:\.[\w-]+)+)?)/;

/** Every reference in a text, in order. Code and links are the caller's to leave out (`commentTree`). */
export function findReferences(text: string): FoundReference[] {
  const found: FoundReference[] = [];
  for (const match of text.matchAll(CANDIDATE)) {
    const read = readCandidate(match[0]);
    if (read) found.push({ reference: read.reference, source: read.source, from: match.index, to: match.index + read.source.length });
  }
  return found;
}

function readCandidate(candidate: string): { reference: CommentReference; source: string } | null {
  if (candidate.startsWith('@')) return readMention(candidate);
  if (candidate.startsWith(':')) return readEmoji(candidate);
  const source = candidate.replace(TRAILING_PUNCTUATION, '');
  const reference = source.startsWith('uvcs://') ? readLink(source) : readSpec(source);
  return reference && { reference, source };
}

function readMention(candidate: string): { reference: CommentReference; source: string } | null {
  const name = MENTION.exec(candidate)?.[1]?.replace(/[.-]+$/, '');
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
