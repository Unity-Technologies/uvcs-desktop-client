import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import type { CachedObject } from './cachedSummary';
import type { UnreadObject } from './chipContent';
import { knownServersQuery, remoteObjectOf, remoteObjectQuery, serverReads } from './remoteObjects';

/**
 * Another repository's object a chip names (`remoteObjectOf`), as read: by the comment shown in full around it
 * (`ResolvedReferences`, the place's server only), or while its card is open (`cardOpen`) when it's on another
 * server the user works with (`serverReads`), never as it draws. Nothing for one of the place's own; nothing ever for
 * a server the user doesn't work with, whose card says so. `unread` says why there is nothing.
 */
export function useRemoteObject(reference: CommentReference, placeRepository: string | undefined): { found?: CachedObject; unread?: UnreadObject; cardOpen: (open: boolean) => void } {
  const object = useMemo(() => remoteObjectOf(reference, placeRepository), [reference, placeRepository]);
  const [cardOpen, setCardOpen] = useState(false);
  const otherServer = object !== null && !object.onPlaceServer;
  // The user's servers (a local `cm profile list`, read once for the window), asked for only once a card of another server opens.
  const servers = useQuery({ ...knownServersQuery, enabled: otherServer && cardOpen });
  const reads = object ? serverReads(object, servers.data?.map((profile) => profile.server)) : 'never';
  const enabled = reads === 'onShow' || (reads === 'onCard' && cardOpen);
  const { data } = useQuery(object && reads !== 'never' && reads !== 'unknownYet' ? remoteObjectQuery(object, undefined, enabled) : { queryKey: ['remoteObject', 'none'], queryFn: skipToken });
  return {
    found: data && 'found' in data ? data.found : undefined,
    unread: unreadOf(data, object && reads === 'never' && otherServer && servers.data ? object.server : null),
    cardOpen: setCardOpen,
  };
}

function unreadOf(data: { found: CachedObject } | { missing: true } | { unreadable: true } | undefined, unknownServer: string | null): UnreadObject | undefined {
  if (unknownServer) return { kind: 'unknownServer', server: unknownServer };
  if (data && 'missing' in data) return { kind: 'missing' };
  if (data && 'unreadable' in data) return { kind: 'unreadable' };
  return undefined;
}
