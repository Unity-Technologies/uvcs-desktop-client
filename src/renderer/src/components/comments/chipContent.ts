import type { LinkObject, LinkPage, RepositoryLink } from '@shared/links/link';
import { serverAuthority } from '@shared/links/linkSegments';
import { branchLabel } from '../../lib/branchLabels';
import { displayName } from '../../lib/userName';
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
      /** The object as the place's caches hold it, for its summary (`useCachedObject`): one of the place's own only. */
      cachedAs?: CommentReference;
    }
  | { kind: 'user'; name: string }
  | { kind: 'emoji'; glyph: string; name: string };

/**
 * `placeRepository`: the window's (`game@acme@unity`), so an object named in it however it's written (`cs:12`,
 * `cs:12@game`, its `uvcs://` link) reads as one of the place's own.
 */
export function chipContent(reference: CommentReference, placeRepository?: string): ChipContent {
  const chip = chipOf(reference);
  if (chip.kind !== 'object') return chip;
  const local = !chip.target.repository || isPlaceRepository(chip.target.repository, placeRepository);
  if (!local) return chip;
  const { repository: _named, target, ...rest } = chip;
  const { repository: _targetRepository, ...localTarget } = target;
  const cachedAs = cachedReferenceOf(localTarget.object);
  return { ...rest, target: localTarget, ...(cachedAs && !localTarget.page && { cachedAs }) };
}

/** `game@acme@unity` names the place's repository, and so does `game` alone, on the place's server. */
function isPlaceRepository(repository: string, placeRepository: string | undefined): boolean {
  if (!placeRepository) return false;
  return repository === placeRepository || (!repository.includes('@') && repository === placeRepository.split('@')[0]);
}

function cachedReferenceOf(object: LinkObject | undefined): CommentReference | undefined {
  switch (object?.kind) {
    case 'changeset':
    case 'shelve':
    case 'codeReview':
      return { kind: object.kind, id: object.id };
    case 'branch':
    case 'label':
      return { kind: object.kind, name: object.name };
    default:
      return undefined;
  }
}

function chipOf(reference: CommentReference): ChipContent {
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

/**
 * The repository a chip's object is in, as `cm` names it: the one it names (`art@acme@unity`), on the place's server
 * when it names none (`art`), else the place's own.
 */
export function referenceRepository(target: ChipTarget, placeRepository: string): string {
  if (!target.repository) return placeRepository;
  if (target.repository.includes('@')) return target.repository;
  const at = placeRepository.indexOf('@');
  return at < 0 ? target.repository : `${target.repository}${placeRepository.slice(at)}`;
}

/** What the window read of a chip's object (`useCachedObject`): its fields, whichever it has. */
export interface CachedRecord {
  comment?: string;
  /** A code review's. */
  title?: string;
  status?: string;
  owner?: string;
  date?: string;
}

/**
 * A chip's hover card, as the Branch Explorer's (`HoverCard`): the comment read, first, drawn as a comment's line,
 * then what the object is, who made it and when; what it is alone while nothing read it. Nothing is asked for.
 */
export interface ChipCard {
  /** The comment (a review's title) to lead with; none leads with `title`. */
  comment?: string;
  /** The object in words: "Changeset 4". */
  title: string;
  meta: string[];
}

/** Why another repository's object has nothing to show (`remoteObjectQuery`, `serverReads`). */
export type UnreadObject = { kind: 'missing' } | { kind: 'unreadable' } | { kind: 'unknownServer'; server: string };

/**
 * `unread`: why another repository's object has nothing to show, which the card says in place of where it is: the
 * repository has none by that name, it couldn't be read from (no access, out of reach), or it is on a server the user
 * doesn't work with, which is never read.
 */
export function chipCard(chip: { title: string; repository?: string }, cached: CachedRecord | undefined, ago: (date: string) => string, unread?: UnreadObject): ChipCard {
  const comment = cached?.title || cached?.comment || undefined;
  const meta = [
    ...(comment ? [chip.title] : []),
    ...(cached?.status ? [cached.status] : []),
    ...(cached?.owner ? [displayName(cached.owner)] : []),
    ...(cached?.date ? [ago(cached.date)] : []),
    ...(chip.repository ? [repositoryWords(chip.title, chip.repository, unread)] : []),
  ];
  return comment ? { comment, title: chip.title, meta } : { title: chip.title, meta };
}

function repositoryWords(title: string, repository: string, unread: UnreadObject | undefined): string {
  switch (unread?.kind) {
    case 'missing':
      return `No ${title.charAt(0).toLowerCase()}${title.slice(1)} in ${repository}`;
    case 'unreadable':
      return `Couldn't read it from ${repository}`;
    case 'unknownServer':
      return `In ${repository} on ${serverAuthority(unread.server)}, not a server you use`;
    default:
      return `In ${repository}`;
  }
}

/** A person's card: their name as shown, then as `cm` knows them, unless it reads the same ("Ana" over "ana"). */
export function personCard(name: string): ChipCard {
  const title = displayName(name);
  return { title, meta: title.toLowerCase() === name.toLowerCase() ? [] : [name] };
}

/** How an emoji is read aloud: its name in words (`white_check_mark` as "white check mark"). */
export function emojiLabel(name: string): string {
  return name.replace(/_/g, ' ');
}

/** A chip's name for screen readers: what it shows, read as words (`Changeset 4, Merge request fixes`). */
export function chipName(title: string, summary: string | undefined): string {
  return summary ? `${title}, ${summary}` : title;
}
