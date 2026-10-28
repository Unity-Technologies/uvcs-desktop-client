import type { LinkObject, LinkPage, RepositoryLink } from '@shared/links/link';
import { branchLabel } from '../../lib/branchLabels';
import type { CommentReference, ReferencePoint } from '../../lib/comments/commentReferences';
import { lastSegment } from '../../lib/paths';

export type ChipIcon = 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' | 'file' | 'link';

/** What a click on a chip opens: an object (or a page of it) in its repository, the place's when none is named. */
export interface ChipTarget {
  /** As `cm` names it after the spec's `@`: `game@acme@unity`, or `game` on the place's server. */
  repository?: string;
  object?: LinkObject;
  page?: LinkPage;
}

/** How a reference shows in a comment (docs/features/rich-comments.md, "How references show"). */
export type ChipContent =
  | {
      kind: 'object';
      icon: ChipIcon;
      /** The object's own name or number: "4207", "task-2210", "v1.4.0". */
      label: string;
      /** The object in words, for the tooltip and screen readers: "Changeset 4207", "Branch /main/task-2210". */
      title: string;
      /** The repository it is in, named when it isn't the place's own. */
      repository?: string;
      target: ChipTarget;
    }
  | { kind: 'user'; name: string }
  | { kind: 'emoji'; glyph: string; name: string };

export function chipContent(reference: CommentReference): ChipContent {
  switch (reference.kind) {
    case 'user':
      return { kind: 'user', name: reference.name };
    case 'emoji':
      return { kind: 'emoji', glyph: reference.glyph, name: reference.name };
    case 'link':
      return linkChip(reference.link);
    case 'file': {
      const at = pointWords(reference.at);
      return objectChip('file', lastSegment(reference.path), `${reference.path} at ${at}`, reference.repository, {
        object: pointObject(reference.at),
        page: { kind: 'diffFile', path: reference.path },
      });
    }
    default:
      return objectChip(iconOf(reference), labelOf(reference), titleOf(reference), reference.repository, { object: linkObjectOf(reference) });
  }
}

type ObjectReference = Extract<CommentReference, { kind: 'changeset' | 'branch' | 'label' | 'shelve' | 'codeReview' }>;

function objectChip(icon: ChipIcon, label: string, title: string, repository: string | undefined, target: ChipTarget): ChipContent {
  return repository
    ? { kind: 'object', icon, label, title, repository: repositoryName(repository), target: { ...target, repository } }
    : { kind: 'object', icon, label, title, target };
}

function iconOf(reference: ObjectReference): ChipIcon {
  return reference.kind;
}

function labelOf(reference: ObjectReference): string {
  switch (reference.kind) {
    case 'branch':
      return branchLabel(reference.name);
    case 'label':
      return reference.name;
    default:
      return String(reference.id);
  }
}

function titleOf(reference: ObjectReference): string {
  switch (reference.kind) {
    case 'changeset':
      return `Changeset ${reference.id}`;
    case 'branch':
      return `Branch ${reference.name}`;
    case 'label':
      return `Label ${reference.name}`;
    case 'shelve':
      return `Shelve ${reference.id}`;
    case 'codeReview':
      return `Code review ${reference.id}`;
  }
}

function linkObjectOf(reference: ObjectReference): LinkObject {
  switch (reference.kind) {
    case 'branch':
    case 'label':
      return { kind: reference.kind, name: reference.name };
    default:
      return { kind: reference.kind, id: reference.id };
  }
}

function pointObject(point: ReferencePoint): LinkObject {
  return point.kind === 'branch' || point.kind === 'label' ? { kind: point.kind, name: point.name } : { kind: point.kind, id: point.id };
}

function pointWords(point: ReferencePoint): string {
  switch (point.kind) {
    case 'changeset':
      return `changeset ${point.id}`;
    case 'shelve':
      return `shelve ${point.id}`;
    case 'branch':
      return `branch ${point.name}`;
    case 'label':
      return `label ${point.name}`;
  }
}

/** A `uvcs://` link reads as what it opens: its object as that object's chip, a view or a file by its name. */
function linkChip(link: RepositoryLink): ChipContent {
  const repository = `${link.repository}@${link.server}`;
  const target: ChipTarget = { repository, ...(link.object && { object: link.object }), ...(link.page && { page: link.page }) };
  const path = link.page && 'path' in link.page ? link.page.path : undefined;
  const item = path && path !== '/' ? lastSegment(path) : undefined;
  if (link.object) {
    const { icon, label, title } = linkObjectWords(link.object);
    return { kind: 'object', icon: item ? 'file' : icon, label: item ?? label, title: item ? `${path} in ${title.toLowerCase()}` : title, repository: link.repository, target };
  }
  return { kind: 'object', icon: item ? 'file' : 'link', label: item ?? link.repository, title: path ?? link.repository, repository: link.repository, target };
}

function linkObjectWords(object: LinkObject): { icon: ChipIcon; label: string; title: string } {
  switch (object.kind) {
    case 'changeset':
      return { icon: 'changeset', label: String(object.id), title: `Changeset ${object.id}` };
    case 'changesetRange':
      return { icon: 'changeset', label: `${object.from}…${object.to}`, title: `Changesets ${object.from} to ${object.to}` };
    case 'branch':
      return { icon: 'branch', label: branchLabel(object.name), title: `Branch ${object.name}` };
    case 'label':
      return { icon: 'label', label: object.name, title: `Label ${object.name}` };
    case 'labelRange':
      return { icon: 'label', label: `${object.from}…${object.to}`, title: `Labels ${object.from} to ${object.to}` };
    case 'shelve':
      return { icon: 'shelve', label: String(object.id), title: `Shelve ${object.id}` };
    case 'codeReview':
      return { icon: 'codeReview', label: String(object.id), title: `Code review ${object.id}` };
  }
}

/** The repository's own name, its server left to the tooltip: `game` for `game@acme@unity`. */
function repositoryName(repository: string): string {
  return repository.split('@')[0] ?? repository;
}
