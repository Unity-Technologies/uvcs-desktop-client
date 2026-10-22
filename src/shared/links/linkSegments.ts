/**
 * How a link writes and reads its parts (docs/features/deep-links.md, "Writing the parts"): each segment
 * percent-encoded as UTF-8, a server's organization joined by `.`.
 */

/**
 * What no name in a link may hold, decoded (`parseLink`'s `decodedAll`), so no link writes it (`writesAsLink`): a
 * line break or a quote, which would end a `cm shell` argument, and a backslash, a separator on Windows.
 */
export const UNWRITABLE_IN_NAMES = /[\\\u0000-\u001f\u007f"]/;

/** Words a link reads as its own where a branch's segments go: a branch segment spelling one is written encoded. */
const BRANCH_KEYWORDS: ReadonlySet<string> = new Set(['-', 'diff', 'path']);

/**
 * One segment, percent-encoded: `encodeURIComponent`, plus `!'()*`, which a markdown link (`[cs:12](…)`) or a chat
 * would end the link at or read as markup. `-` alone is the separator (`/-/`), so a name that is just `-` is `%2D`.
 */
export function encodeSegment(text: string): string {
  if (text === '-') return '%2D';
  return encodeURIComponent(text).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * A branch's segment: a segment spelling a word the link reads after a branch (`-`, and the older links' `diff` and
 * `path`) is written with its first letter encoded, so `/main/diff` stays a branch: `branches/main/%64iff`.
 */
export function encodeBranchSegment(text: string): string {
  if (!BRANCH_KEYWORDS.has(text)) return encodeSegment(text);
  return `%${text.charCodeAt(0).toString(16).toUpperCase()}${text.slice(1)}`;
}

/** Whether a segment as written (not decoded) is a word the link reads after a branch's segments. */
export function isBranchKeyword(rawSegment: string): boolean {
  return BRANCH_KEYWORDS.has(rawSegment);
}

/** A segment as written, decoded: a bare `+` is a space, as the official client's links write spaces. Null when malformed. */
export function decodeSegment(rawSegment: string): string | null {
  try {
    return decodeURIComponent(rawSegment.replaceAll('+', ' '));
  } catch {
    return null;
  }
}

/** A repository path as segments: `/Assets/My Player.cs` → `Assets/My%20Player.cs`; the root is none. */
export function encodePath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeSegment).join('/');
}

/** Segments as a repository path: `['Assets', 'Player.cs']` → `/Assets/Player.cs`, none → `/`. */
export function pathOf(segments: readonly string[]): string {
  return `/${segments.join('/')}`;
}

/** The servers whose `@` a link writes as `.`: Unity organizations (`acme@unity`, `acme@cloud`). */
const ORGANIZATION_SERVER = /^(.+)@(cloud|unity)$/i;
const ORGANIZATION_AUTHORITY = /^(.+)\.(cloud|unity)$/i;
/** A protocol a server may be written with (`ssl://host:8088`), which a link leaves out. */
const SERVER_PROTOCOL = /^(?:ssl|udt|tcp):\/\//i;

/** A server as a link's authority: `acme@unity` → `acme.unity`, `ssl://host:8088` → `host:8088`, `local` as it is. */
export function serverAuthority(server: string): string {
  const organization = ORGANIZATION_SERVER.exec(server);
  const authority = organization ? `${organization[1]}.${organization[2]}` : server.replace(SERVER_PROTOCOL, '');
  return authority.replace(/[^A-Za-z0-9.\-_~:[\]]/g, (character) => encodeURIComponent(character));
}

/**
 * A link's authority as the server `cm` takes: `acme.unity` → `acme@unity`; one with a port, or another name, as it
 * is. Null when malformed. A host named like an organization with no port (`build.cloud`) reads as one: servers
 * outside Unity Cloud are written with their port.
 */
export function serverOf(authority: string): string | null {
  const decoded = decodeSegment(authority);
  if (!decoded) return null;
  const organization = ORGANIZATION_AUTHORITY.exec(decoded);
  return organization && !decoded.includes(':') ? `${organization[1]}@${organization[2]}` : decoded;
}

/**
 * Whether two servers are the same one, as links name them: by host and port, whatever protocol either is written
 * with (`ssl://host:8088` and `host:8088`), an organization's name in any case.
 */
export function sameServer(a: string, b: string): boolean {
  return a.replace(SERVER_PROTOCOL, '').toLowerCase() === b.replace(SERVER_PROTOCOL, '').toLowerCase();
}
