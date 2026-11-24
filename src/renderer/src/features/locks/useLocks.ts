import { useQuery } from '@tanstack/react-query';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { locksQuery } from './locksQuery';

export function useLocks(onlyMine: boolean) {
  const place = usePlace();
  const repository = usePlaceRepository();
  return useQuery({ ...locksQuery(place, repository, onlyMine ? 'mine' : 'everyone'), enabled: Boolean(repository) });
}
