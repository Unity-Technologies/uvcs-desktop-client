import { RefreshCw } from 'lucide-react';
import { invalidatePlace } from '../app/queryClient';
import { usePlace } from '../app/workspace/useWorkspace';
import { IconButton } from '../ui/IconButton';

/** A view's Refresh: reads again what the place's views show, its icon spinning while the view's data is read. */
export function ViewRefreshButton({ fetching }: { fetching: boolean }) {
  const place = usePlace();
  return <IconButton icon={<RefreshCw size={14} className={fetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidatePlace(place)} />;
}
