import { FolderX, PictureInPicture2 } from 'lucide-react';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { CloseMergeButton } from '../../features/merge/CloseMergeButton';
import { useNavigation } from '../navigation/navigationStore';
import { PageContent } from '../navigation/pageRegistry';
import type { Page } from '../navigation/pages';
import { usePageShown } from '../navigation/pageShown';
import { usePageTitle } from '../navigation/usePageTitle';
import { useBackButtons } from '../navigation/useBackButtons';
import { viewDefinition } from '../navigation/viewRegistry';
import { showsPage, type ViewId } from '../navigation/views';
import { usePlace } from '../workspace/useWorkspace';
import { EmptyState } from '../../ui/EmptyState';
import { useShortcut } from '../../lib/useShortcut';
import { IconButton } from '../../ui/IconButton';
import { Stowable } from '../../ui/Stowable';
import { isMovablePage } from '../pageWindow/movablePages';
import { movePageToNewWindow } from '../pageWindow/openInNewWindow';
import { CopyLinkButton } from '../links/CopyLinkButton';
import { Breadcrumb } from './Breadcrumb';
import styles from './PageFrame.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface PageFrameProps {
  page: Page;
  /** The view the page is over, and the page under it, if any: what its breadcrumb goes back to. */
  view: ViewId;
  previous: Page | undefined;
}

/**
 * A page with its breadcrumb. What it goes back to comes from its props, not from the view shown, as the page of a
 * view kept mounted, hidden, renders too (`KeptView`).
 */
export function PageFrame({ page, view, previous }: PageFrameProps) {
  const goBack = useNavigation((state) => state.goBack);
  const place = usePlace();
  const title = usePageTitle(page);
  const previousTitle = usePageTitle(previous);
  const diffExpanded = useDiffExpanded();
  const shown = usePageShown();
  useShortcut(hotkey('back'), goBack, shown);
  useBackButtons(goBack, shown);

  return (
    <div className={styles.frame}>
      <Stowable stowed={diffExpanded}>
        <div className={styles.breadcrumb}>
          <Breadcrumb back={{ label: previousTitle ?? viewDefinition(view).label, onClick: goBack }} current={title} />
          <CopyLinkButton className={styles.copyLink} page={page} />
          {isMovablePage(page) && (
            <IconButton
              className={styles.newWindow}
              size="small"
              icon={<PictureInPicture2 size={14} />}
              label="Open in new window"
              onClick={() => movePageToNewWindow(page)}
            />
          )}
          {page.kind === 'merge' && <CloseMergeButton className={styles.closeMerge} />}
        </div>
      </Stowable>
      <div className={styles.content}>
        {showsPage(place, page) ? (
          <PageContent page={page} />
        ) : (
          <EmptyState icon={<FolderX size={20} />} title="This needs a workspace" description="Create a workspace of this repository to merge into it." />
        )}
      </div>
    </div>
  );
}
