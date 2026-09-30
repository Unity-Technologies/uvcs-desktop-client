import { RefreshCw } from 'lucide-react';
import { invalidateWorkspace } from '../app/queryClient';
import { IconButton } from '../ui/IconButton';

/** A view's Refresh: reads again what the workspace's views show, its icon spinning while the view's data is read. */
export function ViewRefreshButton({ workspacePath, fetching }: { workspacePath: string; fetching: boolean }) {
  return <IconButton icon={<RefreshCw size={14} className={fetching ? 'spinning' : undefined} />} label="Refresh" onClick={() => void invalidateWorkspace(workspacePath)} />;
}
