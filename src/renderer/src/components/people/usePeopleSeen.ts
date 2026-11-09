import { useMemo } from 'react';
import { placeId } from '@shared/domain/place';
import { usePlace } from '../../app/workspace/useWorkspace';
import { createPeopleSeen } from './peopleSeen';

const peopleSeen = createPeopleSeen();

/**
 * The people a list read from the server can offer: everyone its rows have shown this session. A list filtered by
 * people on the server reads only theirs, so the others it showed before stay offered, with no query to list people.
 */
export function usePeopleSeen<Row>(list: string, rows: readonly Row[] | undefined, ownerOf: (row: Row) => string): readonly string[] {
  const place = placeId(usePlace());
  return useMemo(() => peopleSeen.remember(place, list, (rows ?? []).map(ownerOf)), [place, list, rows, ownerOf]);
}

/** Everyone the place's lists have shown this session, for what offers people without listing them (`@` in a comment). */
export function peopleSeenIn(place: string): string[] {
  return peopleSeen.everyone(place);
}
