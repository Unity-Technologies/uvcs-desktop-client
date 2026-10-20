import { ChevronLeft, Crosshair } from 'lucide-react';
import { useEffect } from 'react';
import { useShortcut } from '../../lib/useShortcut';
import { hotkey } from '../../lib/shortcutRegistry';
import { Tooltip } from '../../ui/Tooltip';
import { ToggleChip } from '../../ui/ToggleChip';
import { useNavigation } from '../navigation/navigationStore';
import { PageContent, pageTitle } from '../navigation/pageRegistry';
import { useBackButtons } from '../navigation/useBackButtons';
import { TopBar } from '../shell/TopBar';
import { useWorkspaceWatcher } from '../shell/useWorkspaceWatcher';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { pageWindowGoBack } from './pageWindowNavigation';
import { usePageWindow } from './pageWindowStore';
import { usePageWindowCommands } from './usePageWindowCommands';
import { setFollowingSelection, useFollowSelection } from './useFollowSelection';
import styles from './PageWindowScreen.module.css';

/**
 * A page window: one page of the workspace (a diff, a history…), opened from a workspace window to read beside it,
 * often on another display. Its top bar says what it shows, and offers to follow that window's selection.
 */
export function PageWindowScreen() {
  const pages = useNavigation((state) => state.pages);
  useWorkspaceWatcher();
  useFollowSelection();
  usePageWindowCommands();
  usePageWindowTitle();
  useShortcut(hotkey('back'), pageWindowGoBack);
  useBackButtons(pageWindowGoBack);

  const page = pages.at(-1);
  if (!page) return null;
  const previous = pages.at(-2);

  return (
    <div className={styles.screen}>
      <TopBar end={<FollowSelectionChip />}>
        <div className={styles.title}>
          {previous && (
            <>
              <button className={styles.back} onClick={pageWindowGoBack}>
                <ChevronLeft size={15} />
                {pageTitle(previous)}
              </button>
              <span className={styles.separator}>/</span>
            </>
          )}
          <span className={styles.current}>{pageTitle(page)}</span>
        </div>
      </TopBar>
      <main className={styles.content}>
        <PageContent key={pages.length} page={page} />
      </main>
    </div>
  );
}

/** Quiet until turned on: an outlined chip in the top bar's corner, lit while the window follows the selection. */
function FollowSelectionChip() {
  const following = usePageWindow((state) => state.following);
  return (
    <Tooltip content={following ? 'Showing what you select in the main window' : 'Show what you select in the main window'}>
      <ToggleChip pressed={following} onChange={setFollowingSelection} icon={<Crosshair size={13} />}>
        Follow selection
      </ToggleChip>
    </Tooltip>
  );
}

/** "<page> — <workspace>": what the OS lists the window as (the Window menu, Mission Control, the taskbar). */
function usePageWindowTitle(): void {
  const page = useNavigation((state) => state.pages.at(-1));
  const { data: workspace } = useWorkspaceInfo();
  useEffect(() => {
    if (page) document.title = workspace ? `${pageTitle(page)} — ${workspace.name}` : pageTitle(page);
  }, [page, workspace]);
}
