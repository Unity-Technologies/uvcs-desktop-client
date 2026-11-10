import { RefreshCw } from 'lucide-react';
import { refreshShown } from '../app/refresh/refreshShown';
import { usePlace } from '../app/workspace/useWorkspace';
import { hotkey } from '../lib/shortcutRegistry';
import { IconButton } from '../ui/IconButton';

/**
 * A view's or page's Refresh: what ⌘R does (`refreshShown`), reading again what the view shows, or only what the page
 * in front shows when it says (a code review's). Its icon spins while that is read.
 */
export function ViewRefreshButton({ fetching }: { fetching: boolean }) {
  const place = usePlace();
  return (
    <IconButton
      icon={<RefreshCw size={14} className={fetching ? 'spinning' : undefined} />}
      label="Refresh"
      shortcut={hotkey('refresh')}
      onClick={() => void refreshShown(place)}
    />
  );
}
