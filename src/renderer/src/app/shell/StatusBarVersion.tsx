import { useQuery } from '@tanstack/react-query';
import { CircleArrowUp } from 'lucide-react';
import { openAboutDialog } from '../about/AboutDialog';
import { appInfoQuery } from '../about/appInfoQuery';
import { versionItem } from '../updates/versionItem';
import { useUpdateStore } from '../updates/updateStore';
import styles from './StatusBar.module.css';

/** The app's version at the end of the status bar, or "Update ready" once one is (`versionItem`); it opens About. */
export function StatusBarVersion() {
  const { data: info } = useQuery(appInfoQuery);
  const status = useUpdateStore((state) => state.status);
  if (!info) return null;

  const item = versionItem(info.version, status);
  return (
    <div className={styles.appVersion}>
      <button
        className={`${styles.item} ${styles.version}`}
        data-update-ready={item.updateReady}
        onClick={openAboutDialog}
        data-tip={item.tip}
        data-tip-sub={item.detail}
      >
        {item.updateReady && <CircleArrowUp size={12} className={styles.icon} />}
        {item.label}
      </button>
    </div>
  );
}
