import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { queryKeys } from '../../../api/queryKeys';
import { queryClient } from '../../../app/queryClient';
import { useSettledValue } from '../../../lib/useSettled';
import { contentCaching, contentQuery } from './contentQueries';

export interface DiffContents {
  original: ContentSource;
  modified: ContentSource;
  left: FileContent;
  right: FileContent;
}

/**
 * Both versions of a file, loaded as one pair so they always arrive together. While another
 * file loads, the previous pair stays as placeholder data: fast navigation swaps diffs
 * instead of flashing a spinner. A pair already read shows at once; one not read yet as the selection
 * settles on it (`useSettledValue`): holding ↓ through a list of files reads none of the files it passes, each one
 * or two `cm cat`s.
 */
export function useDiffContents(place: Place, original: ContentSource, modified: ContentSource) {
  const queryKey = queryKeys.inPlace(place, 'diffContents', original, modified);
  const pair = JSON.stringify(queryKey);
  const settled = useSettledValue(pair, pair) === pair;
  return useQuery({
    queryKey,
    enabled: settled || queryClient.getQueryData(queryKey) !== undefined,
    queryFn: async (): Promise<DiffContents> => {
      const [left, right] = await Promise.all([readContent(place, original), readContent(place, modified)]);
      return { original, modified, left, right };
    },
    ...contentCaching([original, modified]),
    placeholderData: keepPreviousData,
  });
}

/** Each side keeps its own cache entry, shared with other views of the same version. */
function readContent(place: Place, source: ContentSource): Promise<FileContent> {
  return queryClient.fetchQuery(contentQuery(place, source));
}
