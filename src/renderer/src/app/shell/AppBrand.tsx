import { AppMark } from '../../components/AppMark';
import { APP_NAME } from '../../lib/appIdentity';
import { openAboutDialog } from '../about/AboutDialog';
import styles from './AppBrand.module.css';

/**
 * The app's mark, after the window's buttons in the sidebar's top band, its name beside it where there's room (the
 * home screen; a workspace's sidebar is narrower and names the workspace just below). It opens the About dialog.
 */
export function AppBrand({ named }: { named: boolean }) {
  return (
    <button type="button" className={styles.brand} data-tip={`About ${APP_NAME}`} aria-label={`About ${APP_NAME}`} onClick={openAboutDialog}>
      <AppMark size={20} />
      {named && <span className={styles.name}>{APP_NAME}</span>}
    </button>
  );
}
