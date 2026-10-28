import { repositoryPlace } from '@shared/domain/place';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import type { CachedObject } from './cachedSummary';
import { chipContent, referenceRepository } from './chipContent';

/**
 * How many objects of other repositories a comment shown in full reads as it shows: each is one `cm find` on a
 * server many people share, and a comment pasting a list of changesets must not send dozens. The rest read as their
 * card opens, as a row's do (docs/features/rich-comments.md, "How references show").
 */
export const MAX_RESOLVED_PER_COMMENT = 10;

/**
 * An object of another repository than the place's that one command reads (`cm find … on repository`): a
 * changeset or a label. A branch takes two (its hidden ones apart), a shelve has no read of its own, and a code
 * review reads its target's name too: they keep what their chip shows.
 */
export type RemoteObject = { repository: string; kind: 'changeset'; id: number } | { repository: string; kind: 'label'; name: string };

/** What reading a remote object gave: its fields for the chip and its card, or that it couldn't be read. */
export type RemoteRead = { found: CachedObject } | { unreadable: true };

/** The other repository's object a reference names, or null: one of the place's own, or nothing one command reads. */
export function remoteObjectOf(reference: CommentReference, placeRepository: string | undefined): RemoteObject | null {
  // Until the place's repository is known, `cs:4@game` can't be told from one of its own.
  if (!placeRepository) return null;
  const chip = chipContent(reference, placeRepository);
  if (chip.kind !== 'object' || !chip.target.repository || chip.target.page) return null;
  const repository = referenceRepository(chip.target, placeRepository);
  const object = chip.target.object;
  if (object?.kind === 'changeset') return { repository, kind: 'changeset', id: object.id };
  if (object?.kind === 'label') return { repository, kind: 'label', name: object.name };
  return null;
}

/**
 * What a comment shown in full reads as it shows: its other repositories' objects, once each, in the order they
 * show, up to `limit`. One read is a command per object, never one for several: `cm find` has no `in (…)`, and
 * ids OR-ed together are refused (`noOredIdLookups.test.ts`). An object already read costs nothing (its query's).
 */
export function referencesToResolve(references: readonly CommentReference[], placeRepository: string | undefined, limit = MAX_RESOLVED_PER_COMMENT): RemoteObject[] {
  const objects = new Map<string, RemoteObject>();
  for (const reference of references) {
    if (objects.size >= limit) break;
    const object = remoteObjectOf(reference, placeRepository);
    if (object) objects.set(objectKey(object), object);
  }
  return [...objects.values()];
}

/** The references of a comment read as Markdown (`parseMarkdown`), in order, wherever they are in its blocks. */
export function referencesOfBlocks(blocks: readonly unknown[]): CommentReference[] {
  const found: CommentReference[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') {
      if ((node as { kind?: unknown }).kind === 'reference') found.push((node as { reference: CommentReference }).reference);
      else Object.values(node).forEach(visit);
    }
  };
  visit(blocks);
  return found;
}

/**
 * The query that reads a remote object, through the services every view uses, the repository as the place
 * (`repositoryPlace`): kept apart from the place's own caches by its key. Read once for the session, a failure too
 * (no access, a server out of reach, nothing by that number): the chip keeps what it showed and its card says so,
 * and showing it again, or hovering it, asks the server nothing more. A new window asks again.
 * `enabled` is a row's chip waiting for its card to open.
 */
export function remoteObjectQuery(object: RemoteObject, read: (object: RemoteObject) => Promise<RemoteRead> = readRemoteObject, enabled = true) {
  return {
    queryKey: queryKeys.inPlace(repositoryPlace(object.repository), 'remoteObject', object.kind, object.kind === 'changeset' ? object.id : object.name),
    queryFn: async (): Promise<RemoteRead> => {
      try {
        return await read(object);
      } catch {
        return { unreadable: true };
      }
    },
    enabled,
    staleTime: Infinity,
    meta: IMMUTABLE_QUERY,
  };
}

async function readRemoteObject(object: RemoteObject): Promise<RemoteRead> {
  // Loaded on the first read: a chip draws without the API client.
  const { api } = await import('../../api/client');
  const place = repositoryPlace(object.repository);
  const found = object.kind === 'changeset' ? await api.changesets.get(place, object.id) : await api.labels.get(place, object.name);
  return found ? { found } : { unreadable: true };
}

function objectKey(object: RemoteObject): string {
  return `${object.repository}\n${object.kind}\n${object.kind === 'changeset' ? object.id : object.name}`;
}
