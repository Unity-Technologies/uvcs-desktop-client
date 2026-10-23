import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';

export function useLocks(onlyMine: boolean) {
  const place = usePlace();
  const repository = usePlaceRepository();
  return useQuery({
    queryKey: queryKeys.inPlace(place, 'locks', repository, onlyMine),
    queryFn: () => api.locks.list(place, repository!, { onlyMine }),
    enabled: Boolean(repository),
    placeholderData: (previous) => previous,
  });
}
