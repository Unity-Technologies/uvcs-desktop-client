import { ChevronLeft } from 'lucide-react';
import { Suspense } from 'react';
import { CenteredSpinner } from '../../ui/Spinner';
import { useNavigation } from '../navigation/navigationStore';
import { PageContent, pageTitle } from '../navigation/pageRegistry';
import type { Page } from '../navigation/pages';
import { viewDefinition } from '../navigation/viewRegistry';
import { useShortcut } from '../../lib/useShortcut';
import styles from './PageFrame.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

export function PageFrame({ page }: { page: Page }) {
  const { view, pages, goBack } = useNavigation();
  const previous = pages.at(-2);
  useShortcut(hotkey('back'), goBack);

  return (
    <div className={styles.frame}>
      <div className={styles.breadcrumb}>
        <button className={styles.back} onClick={goBack}>
          <ChevronLeft size={15} />
          {previous ? pageTitle(previous) : viewDefinition(view).label}
        </button>
        <span className={styles.separator}>/</span>
        <span className={styles.current}>{pageTitle(page)}</span>
      </div>
      <div className={styles.content}>
        <Suspense fallback={<CenteredSpinner />}>
          <PageContent page={page} />
        </Suspense>
      </div>
    </div>
  );
}
