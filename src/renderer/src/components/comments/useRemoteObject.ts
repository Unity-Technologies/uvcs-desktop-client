import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import type { CachedObject } from './cachedSummary';
import type { UnreadObject } from './chipContent';
import { chipRead, knownServersFrom, knownServersQuery, remoteObjectOf, remoteObjectQuery } from './remoteObjects';

/**
 * Another repository's object a chip names (`remoteObjectOf`), as read: by the comment shown in full around it
 * (`ResolvedReferences`), or while the chip's card is open (`chipRead`), never as it draws. `unread` says why there
 * is nothing.
 */
export function useRemoteObject(reference: CommentReference, placeRepository: string | undefined): { found?: CachedObject; unread?: UnreadObject; cardOpen: (open: boolean) => void } {
  const object = useMemo(() => remoteObjectOf(reference, placeRepository), [reference, placeRepository]);
  const [cardOpen, setCardOpen] = useState(false);
  // The user's servers, read once a card of another server opens: a local `cm profile list`.
  const accounts = useQuery({ ...knownServersQuery, enabled: object !== null && !object.onPlaceServer && cardOpen });
  const knownServers = useMemo(() => (accounts.data ? knownServersFrom(accounts.data) : undefined), [accounts.data]);
  const { data } = useQuery(object ? remoteObjectQuery(object, undefined, chipRead(object, knownServers, cardOpen, undefined).enabled) : { queryKey: ['remoteObject', 'none'], queryFn: skipToken });
  return {
    found: data && 'found' in data ? data.found : undefined,
    unread: chipRead(object, knownServers, cardOpen, data).unread,
    cardOpen: setCardOpen,
  };
}
