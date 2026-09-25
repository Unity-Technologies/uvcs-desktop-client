import { RefreshCw } from 'lucide-react';
import { invalidateWorkspace } from '../../app/queryClient';
import { useSettings } from '../../app/settings/useSettings';
import { Button } from '../../ui/Button';
import { Tooltip } from '../../ui/Tooltip';
import styles from './RefreshButton.module.css';

/** Refreshes the workspace views. Quietly says so when automatic refresh is off, the only time pressing it matters. */
export function RefreshButton({ workspacePath, fetching }: { workspacePath: string; fetching: boolean }) {
  const { autoRefresh } = useSettings();
  const label = autoRefresh ? 'Refresh' : 'Automatic refresh is off — click to refresh';
  return (
    <Tooltip content={label} shortcut="mod+r">
      <Button
        variant="ghost"
        icon={<RefreshCw size={14} className={fetching ? styles.spinning : undefined} />}
        aria-label={label}
        onClick={() => void invalidateWorkspace(workspacePath)}
      >
        {!autoRefresh && <span className={styles.paused}>paused</span>}
      </Button>
    </Tooltip>
  );
}
