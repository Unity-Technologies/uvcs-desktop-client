import { Crosshair } from 'lucide-react';
import { useEffect } from 'react';
import { useShortcut } from '../../lib/useShortcut';
import { hotkey } from '../../lib/shortcutRegistry';
import { Tooltip } from '../../ui/Tooltip';
import { ToggleChip } from '../../ui/ToggleChip';
import { CopyLinkButton } from '../links/CopyLinkButton';
import { useCopyLinkCommand } from '../links/useCopyLinkCommand';
import { useNavigation } from '../navigation/navigationStore';
import { PageContent, pageTitle } from '../navigation/pageRegistry';
import { useBackButtons } from '../navigation/useBackButtons';
import { Breadcrumb } from '../shell/Breadcrumb';
import { TopBar } from '../shell/TopBar';
import { useWorkspaceWatcher } from '../shell/useWorkspaceWatcher';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { pageKey } from './followSelection';
import { pageWindowGoBack } from './pageWindowNavigation';
import { usePageWindow } from './pageWindowStore';
import { usePageWindowCommands } from './usePageWindowCommands';
import { setFollowingSelection, useFollowSelection } from './useFollowSelection';
import styles from './PageWindowScreen.module.css';

/**
 * A page window: one page of the workspace (a diff, a history…), opened from a workspace window to read beside it,
 * often on another display. Its top bar says what it shows, copies a link to it, and offers to follow that window's
 * selection.
 */
export function PageWindowScreen() {
  const pages = useNavigation((state) => state.pages);
  useWorkspaceWatcher();
  useFollowSelection();
  usePageWindowCommands();
  useCopyLinkCommand();
  usePageWindowTitle();
  useShortcut(hotkey('back'), pageWindowGoBack);
  useBackButtons(pageWindowGoBack);

  const page = pages.at(-1);
  if (!page) return null;
  const previous = pages.at(-2);

  return (
    <div className={styles.screen}>
      <TopBar
        end={
          <>
            <CopyLinkButton page={page} />
            <FollowSelectionChip />
          </>
        }
      >
        <div className={styles.title}>
          <Breadcrumb back={previous && { label: pageTitle(previous), onClick: pageWindowGoBack }} current={pageTitle(page)} />
        </div>
      </TopBar>
      <main className={styles.content}>
        {/* Keyed by what it shows: a followed selection replaces the page with another of the same depth, whose state
            (a branch diff's selected changeset) mustn't carry over. */}
        <PageContent key={`${pages.length}:${pageKey(page)}`} page={page} />
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
