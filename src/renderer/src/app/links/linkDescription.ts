import type { Link, LinkObject, ServerLink } from '@shared/links/link';
import { parseLink } from '@shared/links/parseLink';
import { branchLabel } from '../../lib/branchLabels';
import { lastSegment } from '../../lib/paths';
import { serverChoiceLabel } from '../../lib/servers';

/** A link in words, as the palette's row for a pasted one says what it opens: "Changeset 12 · Player.cs", "game · acme · Unity organization". */
export interface LinkDescription {
  label: string;
  detail: string;
}

export function linkDescription(text: string): LinkDescription {
  const reading = parseLink(text);
  if ('problem' in reading) return { label: 'Open link', detail: text };
  const { link } = reading;
  if (link.kind === 'server') return { label: link.project ?? 'Repositories', detail: link.project ? `Project · ${serverChoiceLabel(link.server)}` : serverChoiceLabel(link.server) };
  const item = link.page && 'path' in link.page && link.page.path && link.page.path !== '/' ? lastSegment(link.page.path) : undefined;
  const subject = link.kind === 'repository' ? (link.object ? objectWords(link.object) : link.repository) : lastSegment(link.folder);
  return { label: item ? `${subject} · ${item}` : subject, detail: placeWords(link) };
}

function objectWords(object: LinkObject): string {
  switch (object.kind) {
    case 'changeset':
      return `Changeset ${object.id}`;
    case 'changesetRange':
      return `Changesets ${object.from} → ${object.to}`;
    case 'branch':
      return `Branch ${branchLabel(object.name)}`;
    case 'label':
      return `Label ${object.name}`;
    case 'labelRange':
      return `Labels ${object.from} → ${object.to}`;
    case 'shelve':
      return `Shelve ${object.id}`;
    case 'codeReview':
      return `Code review ${object.id}`;
  }
}

function placeWords(link: Exclude<Link, ServerLink>): string {
  return link.kind === 'repository' ? `${link.repository} · ${serverChoiceLabel(link.server)}` : link.folder;
}
