import { PictureInPicture2 } from 'lucide-react';
import { useNavigation } from '../navigation/navigationStore';
import { PageContent, pageTitle } from '../navigation/pageRegistry';
import type { Page } from '../navigation/pages';
import { useBackButtons } from '../navigation/useBackButtons';
import { viewDefinition } from '../navigation/viewRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { IconButton } from '../../ui/IconButton';
import { isMovablePage } from '../pageWindow/movablePages';
import { movePageToNewWindow } from '../pageWindow/openInNewWindow';
import { Breadcrumb } from './Breadcrumb';
import styles from './PageFrame.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

export function PageFrame({ page }: { page: Page }) {
  const { view, pages, goBack } = useNavigation();
  const previous = pages.at(-2);
  useShortcut(hotkey('back'), goBack);
  useBackButtons(goBack);

  return (
    <div className={styles.frame}>
      <div className={styles.breadcrumb}>
        <Breadcrumb back={{ label: previous ? pageTitle(previous) : viewDefinition(view).label, onClick: goBack }} current={pageTitle(page)} />
        {isMovablePage(page) && (
          <IconButton
            className={styles.newWindow}
            size="small"
            icon={<PictureInPicture2 size={14} />}
            label="Open in new window"
            onClick={() => movePageToNewWindow(page)}
          />
        )}
      </div>
      <div className={styles.content}>
        <PageContent page={page} />
      </div>
    </div>
  );
}
