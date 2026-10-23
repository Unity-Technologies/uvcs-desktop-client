import type { Link, LinkLines, LinkObject, LinkPage } from './link';
import { encodeBranchSegment, encodePath, encodeSegment, serverAuthority, UNWRITABLE_IN_NAMES } from './linkSegments';

export const LINK_SCHEME = 'uvcs';

/**
 * A link as the app writes it (docs/features/deep-links.md): `uvcs://acme.unity/repos/game/changesets/4207/-/files/Assets/Player.cs#L42`.
 * `parseLink` reads it back as it was.
 */
export function formatLink(link: Link): string {
  if (link.kind === 'server') return `${LINK_SCHEME}://${serverPart(link.server, link.project)}`;
  const place = link.kind === 'repository' ? repositoryPart(link.server, link.repository, link.object) : workspacePart(link.folder);
  return `${LINK_SCHEME}://${place}${link.page ? `/-/${pagePart(link.page)}` : ''}${link.lines ? `#${linesPart(link.lines)}` : ''}`;
}

/**
 * Whether a link can name what it would name: a file, folder, branch or label holding a quote, a line break or a
 * backslash (each legal on macOS and Linux) can't be, as `parseLink` refuses what decodes to one. The app offers no
 * link to such a name rather than one that won't open.
 */
export function writesAsLink(link: Link): boolean {
  if (link.kind === 'server') return !link.project || !UNWRITABLE_IN_NAMES.test(link.project);
  const names = [...(link.kind === 'repository' && link.object ? objectNames(link.object) : []), ...(link.page && 'path' in link.page && link.page.path ? [link.page.path] : [])];
  return !names.some((name) => UNWRITABLE_IN_NAMES.test(name));
}

function objectNames(object: LinkObject): string[] {
  if (object.kind === 'branch' || object.kind === 'label') return [object.name];
  return object.kind === 'labelRange' ? [object.from, object.to] : [];
}

/** `acme.unity`, or a project's repositories there: `acme.unity/projects/Racing` (a `/` in its name `%2F`). */
function serverPart(server: string, project: string | undefined): string {
  return project ? `${serverAuthority(server)}/projects/${encodeSegment(project)}` : serverAuthority(server);
}

function repositoryPart(server: string, repository: string, object: LinkObject | undefined): string {
  const repositoryPart = `${serverAuthority(server)}/repos/${encodeSegment(repository)}`;
  return object ? `${repositoryPart}/${objectPart(object)}` : repositoryPart;
}

function objectPart(object: LinkObject): string {
  switch (object.kind) {
    case 'changeset':
      return `changesets/${object.id}`;
    case 'changesetRange':
      return `changesets/${object.from}..${object.to}`;
    case 'branch':
      return `branches/${object.name.split('/').filter(Boolean).map(encodeBranchSegment).join('/')}`;
    case 'label':
      return `labels/${encodeLabel(object.name)}`;
    case 'labelRange':
      return `labels/${encodeLabel(object.from)}..${encodeLabel(object.to)}`;
    case 'shelve':
      return `shelves/${object.id}`;
    case 'codeReview':
      return `${object.asMergeRequest ? 'merge-requests' : 'code-reviews'}/${object.id}`;
  }
}

/**
 * A label's name: a dot next to another, or ending the name, is written `%2E`, so a name holding `..` (`v1..2`) is
 * never read as a range of two labels, nor a range's names run into its `..`.
 */
function encodeLabel(name: string): string {
  return encodeSegment(name).replace(/\./g, (dot, at: number, text: string) => (text[at - 1] === '.' || text[at + 1] === '.' || at === text.length - 1 ? '%2E' : dot));
}

/** A folder as `file:///` writes it: `/Users/ana/wk`, `C:/wk` → `/C:/wk`, each segment encoded but a drive's colon. */
function workspacePart(folder: string): string {
  const segments = folder.replaceAll('\\', '/').split('/').filter(Boolean);
  return `/${segments.map((segment, index) => (index === 0 && /^[A-Za-z]:$/.test(segment) ? segment : encodeSegment(segment))).join('/')}`;
}

function pagePart(page: LinkPage): string {
  const word = page.kind === 'view' ? page.view : page.kind === 'diffFile' ? 'files' : page.kind;
  const path = page.path === undefined ? '' : encodePath(page.path);
  return path ? `${word}/${path}` : word;
}

function linesPart({ side, first, last }: LinkLines): string {
  const lines = first === last ? `L${first}` : `L${first}-L${last}`;
  return side === 'old' ? `old-${lines}` : lines;
}
