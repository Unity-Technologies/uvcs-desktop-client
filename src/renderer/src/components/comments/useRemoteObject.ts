import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { CommentReference } from '../../lib/comments/commentReferences';
import type { CachedObject } from './cachedSummary';
import { remoteObjectOf, remoteObjectQuery } from './remoteObjects';

/**
 * Another repository's object a chip names (`remoteObjectOf`), as read: by the comment shown in full around it
 * (`ResolvedReferences`), or once its card opens (`wanted`), never as it draws. Nothing for one of the place's own.
 */
export function useRemoteObject(reference: CommentReference, placeRepository: string | undefined): { found?: CachedObject; unreadable: boolean; wanted: () => void } {
  const object = useMemo(() => remoteObjectOf(reference, placeRepository), [reference, placeRepository]);
  const [cardOpened, setCardOpened] = useState(false);
  const { data } = useQuery(object ? remoteObjectQuery(object, undefined, cardOpened) : { queryKey: ['remoteObject', 'none'], queryFn: skipToken });
  return {
    found: data && 'found' in data ? data.found : undefined,
    unreadable: data !== undefined && 'unreadable' in data,
    wanted: () => setCardOpened(true),
  };
}
