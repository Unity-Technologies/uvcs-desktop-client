import { LINK_VIEWS, type Link, type LinkLines, type LinkObject, type LinkPage, type LinkView, type RepositoryLink, type WorkspaceLink } from './link';
import { decodeSegment, isBranchKeyword, pathOf, serverOf, UNWRITABLE_IN_NAMES } from './linkSegments';
import { specLink } from './specLink';

/**
 * What reading a link found: the link, or why it can't be opened. `unknown` is a link this version can read but names
 * something it doesn't know (a page a newer version added): the app may need an update.
 */
export type LinkReading = { link: Link } | { problem: LinkProblem };

export type LinkProblem = { kind: 'notALink' } | { kind: 'malformed' | 'unknown'; detail: string };

/** Longer than any link a person or an agent writes: what is past it is not a link. */
export const MAX_LINK_LENGTH = 8192;

const OBJECT_WORDS: ReadonlySet<string> = new Set(['changesets', 'branches', 'labels', 'shelves', 'shelvesets', 'code-reviews', 'merge-requests']);

/**
 * The older links' way of naming a spec (`plastic://showchangeset=<spec>`, the spec with its repository:
 * `cs:12@game@acme@cloud`), and what each opens.
 */
const LEGACY_SPEC_LINK = /^(?:show|diff)(?:changeset|branch)=(.+)$/i;

/**
 * Reads a `uvcs://` link (docs/features/deep-links.md), and the official client's `plastic://` ones, whose shapes it
 * reads under either scheme ("Older links"). `formatLink` writes what this reads back.
 */
export function parseLink(text: string): LinkReading {
  const written = text.trim().replace(/^<(.*)>$/s, '$1');
  const scheme = /^(?:uvcs|plastic):\/\//i.exec(written);
  if (!scheme) return { problem: { kind: 'notALink' } };
  if (written.length > MAX_LINK_LENGTH) return malformed('It is too long to be a link.');
  // Quotes and line breaks would end a `cm shell` argument, and no link writes them: they come from a pasted text.
  if (/[\u0000-\u001f\u007f"]/.test(written)) return malformed('It holds characters a link never has.');
  const afterScheme = written.slice(scheme[0].length);
  const fragmentAt = afterScheme.indexOf('#');
  const beforeFragment = fragmentAt === -1 ? afterScheme : afterScheme.slice(0, fragmentAt);
  // The only query a link ever had is the older links' `?ui=gluon`, which the app has no use for.
  const body = beforeFragment.split('?')[0]!;
  const lines = fragmentAt === -1 ? undefined : linesIn(afterScheme.slice(fragmentAt + 1));
  if (lines === null) return malformed('Its line numbers are not valid.');
  const reading = readBody(body);
  if ('problem' in reading) return reading;
  // A server's repositories have no lines to show: a fragment there is left out, as any other is.
  return { link: lines && reading.link.kind !== 'server' ? { ...reading.link, lines } : reading.link };
}

function readBody(body: string): LinkReading {
  const legacySpec = LEGACY_SPEC_LINK.exec(body);
  if (legacySpec) {
    const link = specLink(decodeSegment(legacySpec[1]!) ?? '');
    return link ? { link } : malformed('It names no changeset or branch with its repository.');
  }
  if (body.startsWith('/') || body.startsWith('\\')) return readWorkspaceLink(body);
  // `plastic://ssl://host:8088/repos/…`: the older links wrote a server's protocol, which a link leaves out.
  return readRepositoryLink(body.replace(/^(?:ssl|udt|tcp):\/\//i, ''));
}

function readRepositoryLink(body: string): LinkReading {
  const [authority = '', ...segments] = withoutTrailingSlash(body).split('/');
  const server = serverOf(authority);
  if (!server) return malformed('It names no server.');
  if (segments.length === 0) return { link: { kind: 'server', server } };
  if (segments[0]?.toLowerCase() === 'projects') return readProjectLink(server, segments.slice(1));
  if (segments[0]?.toLowerCase() !== 'repos' || !segments[1]) return malformed('It names no repository.');
  // The older links wrote a `/` in a repository's name as it is (`repos/game/art/changesets/…`): the name runs to the
  // first word a link reads after it.
  const nameEnd = segments.findIndex((segment, index) => index > 1 && (OBJECT_WORDS.has(segment) || segment === '-' || segment === 'path'));
  if (nameEnd === -1 && segments.length > 2) return unknown(`It names "${decodeSegment(segments[2]!) ?? segments[2]}" in the repository.`);
  // A `/` in a repository's name is written `%2F` (a nested repository): it's the one part a `/` may decode in.
  const nameSegments = decodedAll(segments.slice(1, nameEnd === -1 ? undefined : nameEnd), { slashes: true });
  if (!nameSegments) return malformed('Its repository name is not valid.');
  const base: RepositoryLink = { kind: 'repository', server, repository: nameSegments.join('/') };
  return readAfterRepository(base, nameEnd === -1 ? [] : segments.slice(nameEnd));
}

/** `…/projects/<project>`: a Unity organization's repositories in that project. */
function readProjectLink(server: string, segments: readonly string[]): LinkReading {
  if (segments.length === 0) return malformed('It names no project.');
  if (segments.length > 1) return unknown(`It names "${decodeSegment(segments[1]!) ?? segments[1]}" in the project.`);
  const [project] = decodedAll(segments, { slashes: true }) ?? [];
  return project ? { link: { kind: 'server', server, project } } : malformed('Its project name is not valid.');
}

function readAfterRepository(base: RepositoryLink, segments: readonly string[]): LinkReading {
  const [word, ...rest] = segments;
  if (word === undefined) return { link: base };
  if (word === '-') return withPage(base, readPlacePage(rest, 'repository'));
  // The older links' `/path/<path>`: the item, in the workspace's Files.
  if (word === 'path') return withPathOf(rest, (path) => ({ link: { ...base, page: { kind: 'view', view: 'files', path } } }));
  const object = readObject(word, rest);
  if ('problem' in object) return object;
  const link: RepositoryLink = { ...base, object: object.object };
  return readAfterObject(link, rest.slice(object.length));
}

/** The object a link's segments name after its repository, and how many segments after the object's word it took. */
type ObjectReading = { object: LinkObject; length: number } | { problem: LinkProblem };

function readObject(word: string, segments: readonly string[]): ObjectReading {
  const [first] = segments;
  if (first === undefined) return malformed(`It names no ${word === 'branches' ? 'branch' : 'object'}.`);
  switch (word) {
    case 'changesets':
      return readChangesets(first);
    case 'branches':
      return readBranch(segments);
    case 'labels':
      return readLabels(first);
    case 'shelves':
    case 'shelvesets': {
      const shelve = idIn(first.replace(/^-/, ''));
      return shelve === null ? malformed('Its shelve number is not valid.') : { object: { kind: 'shelve', id: shelve }, length: 1 };
    }
    default: {
      const review = idIn(first);
      if (review === null) return malformed('Its code review number is not valid.');
      return { object: { kind: 'codeReview', id: review, ...(word === 'merge-requests' ? { asMergeRequest: true } : {}) }, length: 1 };
    }
  }
}

function readChangesets(segment: string): ObjectReading {
  const [from, to, ...more] = segment.split('..').map(idIn);
  if (from === undefined || from === null || to === null || more.length > 0) return malformed('Its changeset number is not valid.');
  return to === undefined ? { object: { kind: 'changeset', id: from }, length: 1 } : { object: { kind: 'changesetRange', from, to }, length: 1 };
}

/** An object's number (a changeset, a shelve, a review); null for anything else, a number too big to be one included. */
function idIn(text: string): number | null {
  const id = /^\d+$/.test(text) ? Number(text) : NaN;
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * A branch's segments run to the first word the link reads after them (`-`; the older links' `path`, and their `diff`
 * as the last segment), as written: a branch segment spelling one is written encoded (`encodeBranchSegment`).
 */
function readBranch(segments: readonly string[]): ObjectReading {
  const end = segments.findIndex((segment, index) => isBranchKeyword(segment) && (segment !== 'diff' || index === segments.length - 1));
  const nameSegments = decodedAll(segments.slice(0, end === -1 ? undefined : end));
  if (!nameSegments || nameSegments.length === 0 || nameSegments.includes('')) return malformed('Its branch name is not valid.');
  return { object: { kind: 'branch', name: pathOf(nameSegments) }, length: nameSegments.length };
}

function readLabels(segment: string): ObjectReading {
  const parts = segment.split('..');
  const names = decodedAll(parts);
  if (!names || names.some((name) => name === '') || names.length > 2) return malformed('Its label name is not valid.');
  const [from = '', to] = names;
  return { object: to === undefined ? { kind: 'label', name: from } : { kind: 'labelRange', from, to }, length: 1 };
}

function readAfterObject(link: RepositoryLink, segments: readonly string[]): LinkReading {
  const [word, ...rest] = segments;
  if (word === undefined) return { link };
  // The older links end in `/diff`, and a review's in the tab it opened on.
  if (rest.length === 0 && (word === 'diff' || (link.object?.kind === 'codeReview' && /^(?:reviewchanges|conversation)$/i.test(word)))) return { link };
  // The older links' `/branches/<branch>/path/<path>`, `/changesets/<n>/path/<path>`: the item as it was there.
  if (word === 'path') return withPathOf(rest, (path) => ({ link: { ...link, page: { kind: 'browse', path } } }));
  if (word !== '-') return unknown(`It names "${decodeSegment(word) ?? word}" after the ${objectNoun(link.object!)}.`);
  return withPage(link, readObjectPage(rest, link.object!));
}

type PageReading = { page: LinkPage } | { problem: LinkProblem };

/** A page of a repository or a workspace: a view (Files and Changes on an item), or an item's browse, history or annotate. */
function readPlacePage(segments: readonly string[], place: 'repository' | 'workspace'): PageReading {
  const [word = '', ...rest] = segments;
  if (!word) return malformed('It names no page after "-".');
  const path = pathIn(rest);
  if (path === null) return malformed('Its path is not valid.');
  if (isLinkView(word)) {
    if (rest.length > 0 && word !== 'files' && word !== 'changes') return unknown(`It names an item in ${word}.`);
    return { page: rest.length > 0 ? { kind: 'view', view: word, path } : { kind: 'view', view: word } };
  }
  if (word === 'browse' && place === 'repository') return { page: { kind: 'browse', path } };
  if ((word === 'history' || word === 'annotate') && rest.length > 0) return { page: { kind: word, path } };
  return unknown(`It names a page "${decodeSegment(word) ?? word}".`);
}

/** Which pages each object has (docs/features/deep-links.md): a shelve, a range and a review only their diff's files. */
const OBJECT_PAGES: Record<LinkObject['kind'], ReadonlySet<string>> = {
  changeset: new Set(['files', 'browse', 'history', 'annotate', 'branch-explorer']),
  branch: new Set(['files', 'browse', 'history', 'annotate', 'branch-explorer']),
  label: new Set(['files', 'browse', 'history', 'annotate', 'branch-explorer']),
  changesetRange: new Set(['files']),
  labelRange: new Set(['files']),
  shelve: new Set(['files']),
  codeReview: new Set(['files']),
};

function readObjectPage(segments: readonly string[], object: LinkObject): PageReading {
  const [word = '', ...rest] = segments;
  if (!word) return malformed('It names no page after "-".');
  if (!OBJECT_PAGES[object.kind].has(word)) return unknown(`It names a page "${decodeSegment(word) ?? word}" of a ${objectNoun(object)}.`);
  const path = pathIn(rest);
  if (path === null) return malformed('Its path is not valid.');
  if (word === 'branch-explorer') return rest.length === 0 ? { page: { kind: 'view', view: 'branch-explorer' } } : unknown('It names an item in the Branch Explorer.');
  if (word === 'browse') return { page: { kind: 'browse', path } };
  if (rest.length === 0) return malformed(`Its ${word} page names no file.`);
  return { page: word === 'files' ? { kind: 'diffFile', path } : { kind: word as 'history' | 'annotate', path } };
}

/**
 * A link to a workspace on this computer: its folder as `file:///` writes one (`/Users/ana/wk`, `/C:/wk`; backslashes
 * read as `/`), then a page after `/-/`.
 */
function readWorkspaceLink(body: string): LinkReading {
  const segments = withoutTrailingSlash(body.replaceAll('\\', '/')).split('/').filter((segment, index) => index === 0 || segment !== '');
  const separator = segments.indexOf('-');
  const folderSegments = decodedAll(segments.slice(1, separator === -1 ? undefined : separator).filter(Boolean));
  if (!folderSegments || folderSegments.length === 0) return malformed('It names no folder.');
  const drive = /^[A-Za-z]:$/.test(folderSegments[0]!);
  const folder = drive ? `${folderSegments[0]}/${folderSegments.slice(1).join('/')}` : pathOf(folderSegments);
  const link = { kind: 'workspace', folder } as const;
  return separator === -1 ? { link } : withPage(link, readPlacePage(segments.slice(separator + 1), 'workspace'));
}

/** `L42`, `L40-L52` (or `L40-52`), `old-L42`; undefined for any other fragment, which a link doesn't use; null for lines out of order. */
function linesIn(fragment: string): LinkLines | undefined | null {
  const match = /^(old-)?L(\d+)(?:-L?(\d+))?$/.exec(fragment);
  if (!match) return undefined;
  const first = Number(match[2]);
  const last = match[3] === undefined ? first : Number(match[3]);
  if (first < 1 || last < first || !Number.isSafeInteger(last)) return null;
  return { side: match[1] ? 'old' : 'new', first, last };
}

function withPage<L extends RepositoryLink | WorkspaceLink>(link: L, page: PageReading): LinkReading {
  return 'problem' in page ? page : { link: { ...link, page: page.page } };
}

function withPathOf(segments: readonly string[], read: (path: string) => LinkReading): LinkReading {
  const path = pathIn(segments);
  return path === null ? malformed('Its path is not valid.') : read(path);
}

/** Segments as a repository path; null when one is malformed or steps out (`.`, `..`). */
function pathIn(segments: readonly string[]): string | null {
  const decoded = decodedAll(segments.filter(Boolean));
  return decoded ? pathOf(decoded) : null;
}

/**
 * Every segment decoded; null when one is malformed, is `.` or `..`, or decodes to what no written link holds: a
 * separator (`%2F`, `%5C`: a path stepping out through one), a line break or a quote (which would end a `cm shell`
 * argument). `slashes` lets a `/` through, for a repository's name.
 */
function decodedAll(segments: readonly string[], { slashes = false } = {}): string[] | null {
  const decoded = segments.map(decodeSegment);
  const valid = (segment: string | null): segment is string =>
    segment !== null && segment !== '.' && segment !== '..' && !UNWRITABLE_IN_NAMES.test(segment) && (slashes || !segment.includes('/'));
  return decoded.every(valid) ? decoded : null;
}

function withoutTrailingSlash(text: string): string {
  return text.replace(/\/+$/, '');
}

function isLinkView(word: string): word is LinkView {
  return (LINK_VIEWS as readonly string[]).includes(word);
}

function objectNoun(object: LinkObject): string {
  switch (object.kind) {
    case 'changeset':
    case 'changesetRange':
      return 'changeset';
    case 'labelRange':
      return 'label';
    case 'codeReview':
      return 'code review';
    default:
      return object.kind;
  }
}

function malformed(detail: string): { problem: LinkProblem } {
  return { problem: { kind: 'malformed', detail } };
}

function unknown(detail: string): { problem: LinkProblem } {
  return { problem: { kind: 'unknown', detail } };
}
