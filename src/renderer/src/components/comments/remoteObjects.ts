import { repositoryPlace } from '@shared/domain/place';
import { sameServer } from '@shared/links/linkSegments';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryMeta';
import type { CachedObject } from './cachedSummary';
import { chipContent, referenceRepository } from './chipContent';

/**
 * How many objects of other repositories a comment shown in full reads as it shows: each is one `cm find` on a
 * server many people share, and a comment pasting a list of changesets must not send dozens. The rest read as their
 * card opens, as a row's do (docs/features/rich-comments.md, "How references show").
 */
export const MAX_RESOLVED_PER_COMMENT = 10;

/**
 * How long a failed read (no access, a server out of reach, a timeout) is kept before a chip shown or hovered asks
 * again: long enough that a comment shown again, or a card hovered twice, asks nothing more, short enough that a
 * server back online recovers within the session.
 */
export const UNREADABLE_RETRY_MS = 5 * 60_000;

/**
 * An object of another repository than the place's that one command reads (`cm find … on repository`): a
 * changeset or a label. A branch takes two (its hidden ones apart), a shelve has no read of its own, and a code
 * review reads its target's name too: they keep what their chip shows. `server`: where it is; `onPlaceServer`: the
 * place's own, which a comment may read as it shows (`serverReads`).
 */
export type RemoteObject = { repository: string; server: string; onPlaceServer: boolean } & ({ kind: 'changeset'; id: number } | { kind: 'label'; name: string });

/**
 * What reading a remote object gave: its fields for the chip and its card; an answer that the repository has none
 * (`missing`), kept as an object is; or a failure (`unreadable`), asked again after `UNREADABLE_RETRY_MS`.
 */
export type RemoteRead = { found: CachedObject } | { missing: true } | { unreadable: true };

/** What a `cm find` line can't carry quoted: a quote, a space or a control character. */
const UNQUOTABLE = /['"\s\p{Cc}]/u;

/** The other repository's object a reference names, or null: one of the place's own, or nothing one command reads. */
export function remoteObjectOf(reference: CommentReference, placeRepository: string | undefined): RemoteObject | null {
  // Until the place's repository is known, `cs:4@game` can't be told from one of its own.
  if (!placeRepository) return null;
  const chip = chipContent(reference, placeRepository);
  if (chip.kind !== 'object' || !chip.target.repository || chip.target.page) return null;
  const repository = referenceRepository(chip.target, placeRepository);
  const object = chip.target.object;
  if (UNQUOTABLE.test(repository) || (object?.kind === 'label' && UNQUOTABLE.test(object.name))) return null;
  const onPlaceServer = sameServer(serverOf(repository), serverOf(placeRepository));
  const server = serverOf(repository);
  if (object?.kind === 'changeset') return { repository, server, onPlaceServer, kind: 'changeset', id: object.id };
  if (object?.kind === 'label') return { repository, server, onPlaceServer, kind: 'label', name: object.name };
  return null;
}

/**
 * When a remote object may be read: its place's own server as a comment shows (`onShow`); another server the user
 * already works with (a profile of theirs, Settings › Accounts, `serversQuery`) only as its chip's card opens
 * (`onCard`); any other server never. For a server with no profile `cm` doesn't fail: it signs in there with the
 * user's own credentials (a password, or a sign-in token), and a comment can name any server: pointing at a chip is no
 * consent to sign in to a stranger's. `*@cloud`: the user signs in to every Unity Cloud organization alike, which all
 * reach Unity's servers. `unknownYet` while the user's servers aren't read.
 */
export function serverReads(object: RemoteObject, knownServers: readonly string[] | undefined): 'onShow' | 'onCard' | 'never' | 'unknownYet' {
  if (object.onPlaceServer) return 'onShow';
  if (!knownServers) return 'unknownYet';
  const everyCloudOrganization = knownServers.includes('*@cloud') && /@cloud$/i.test(object.server);
  return everyCloudOrganization || knownServers.some((known) => sameServer(known, object.server)) ? 'onCard' : 'never';
}

/** A repository spec's server, as `cm` names it after the repository's name: `acme@unity` for `game@acme@unity`. */
function serverOf(repository: string): string {
  return repository.slice(repository.indexOf('@') + 1);
}

/**
 * What a comment shown in full reads as it shows: its other repositories' objects on the place's server (never
 * another server's: `onPlaceServer`), once each, in the order they show, up to `limit`. One read is a command per
 * object, never one for several: `cm find` has no `in (…)`, and ids OR-ed together are refused
 * (`noOredIdLookups.test.ts`). An object already read costs nothing (its query's).
 */
export function referencesToResolve(references: readonly CommentReference[], placeRepository: string | undefined, limit = MAX_RESOLVED_PER_COMMENT): RemoteObject[] {
  const objects = new Map<string, RemoteObject>();
  for (const reference of references) {
    if (objects.size >= limit) break;
    const object = remoteObjectOf(reference, placeRepository);
    if (object?.onPlaceServer) objects.set(objectKey(object), object);
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
 * (`repositoryPlace`): kept apart from the place's own caches by its key. An object read, or an answer that there's
 * none, is kept for the window's life (`gcTime: Infinity`; off screen, bounded as every immutable result is, by
 * `MAX_UNUSED_IMMUTABLE`). Immutable though comments can be edited: a chip's summary of another repository's object
 * is a reminder of what it points at, and the object's own page reads it fresh. A failure is kept for
 * `UNREADABLE_RETRY_MS`, then asked again. Another server's object is read in a process of its own (`ownProcess`).
 * `enabled` is a chip waiting for its card to open.
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
    staleTime: (query: { state: { data?: RemoteRead } }) => (query.state.data && 'unreadable' in query.state.data ? UNREADABLE_RETRY_MS : Infinity),
    gcTime: Infinity,
    // Read on a gesture only (a comment shown, a card opened): coming back to the window, or online, asks nothing.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    meta: IMMUTABLE_QUERY,
  };
}

/**
 * The user's servers (`serversQuery`'s, Settings › Accounts: a local `cm profile list`), under its key, so both read
 * one cache entry. Apart from it so a chip draws without the API client, which loads on the first read.
 */
export const knownServersQuery = {
  queryKey: queryKeys.profiles,
  queryFn: async () => (await import('../../api/client')).api.repositories.servers(),
  staleTime: Infinity,
};

async function readRemoteObject(object: RemoteObject): Promise<RemoteRead> {
  // Loaded on the first read: a chip draws without the API client.
  const { api } = await import('../../api/client');
  const place = repositoryPlace(object.repository);
  // Another server may not answer for its whole timeout: never in a pooled `cm shell` session, which it would hold.
  const read = { ownProcess: !object.onPlaceServer };
  const found = object.kind === 'changeset' ? await api.changesets.find(place, object.id, read) : await api.labels.get(place, object.name, read);
  return found ? { found } : { missing: true };
}

function objectKey(object: RemoteObject): string {
  return `${object.repository}\n${object.kind}\n${object.kind === 'changeset' ? object.id : object.name}`;
}
