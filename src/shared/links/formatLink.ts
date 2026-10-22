import type { Link, LinkLines, LinkObject, LinkPage } from './link';
import { encodeBranchSegment, encodePath, encodeSegment, serverAuthority } from './linkSegments';

export const LINK_SCHEME = 'uvcs';

/**
 * A link as the app writes it (docs/features/deep-links.md): `uvcs://acme.unity/repos/game/changesets/4207/-/files/Assets/Player.cs#L42`.
 * `parseLink` reads it back as it was.
 */
export function formatLink(link: Link): string {
  const place = link.kind === 'repository' ? repositoryPart(link.server, link.repository, link.object) : workspacePart(link.folder);
  return `${LINK_SCHEME}://${place}${link.page ? `/-/${pagePart(link.page)}` : ''}${link.lines ? `#${linesPart(link.lines)}` : ''}`;
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
