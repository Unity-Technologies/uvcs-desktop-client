import { AppMark } from '../../components/AppMark';
import { APP_NAME } from '../../lib/appIdentity';
import { openAboutDialog } from '../about/AboutDialog';
import styles from './AppBrand.module.css';

/** The app's mark and name, at the start of the top bar after the window's buttons. It opens the About dialog. */
export function AppBrand() {
  return (
    <button type="button" className={styles.brand} data-tip={`About ${APP_NAME}`} aria-label={`About ${APP_NAME}`} onClick={openAboutDialog}>
      <AppMark size={20} soft />
      <span className={styles.name}>{APP_NAME}</span>
    </button>
  );
}
