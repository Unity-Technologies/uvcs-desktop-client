import { Pause } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../../app/settings/useSettings';
import { Tooltip } from '../../ui/Tooltip';
import styles from './LiveRefreshToggle.module.css';

/**
 * Whether the changes and the open diff follow the disk as files change (the "Refresh automatically" setting), and a
 * click to pause or resume that, e.g. while an agent rewrites many files.
 */
export function LiveRefreshToggle() {
  const { autoRefresh } = useSettings();
  const updateSettings = useUpdateSettings();
  const label = autoRefresh ? 'Pause live refresh' : 'Resume live refresh: follow file changes as they happen';
  return (
    <Tooltip content={label}>
      <button type="button" className={styles.toggle} data-live={autoRefresh} aria-label={label} onClick={() => updateSettings({ autoRefresh: !autoRefresh })}>
        {autoRefresh ? <span className={styles.dot} /> : <Pause size={10} />}
        {autoRefresh ? 'Live' : 'Paused'}
      </button>
    </Tooltip>
  );
}
