import { Crosshair } from 'lucide-react';
import { useEffect } from 'react';
import { useShortcut } from '../../lib/useShortcut';
import { hotkey } from '../../lib/shortcutRegistry';
import { Tooltip } from '../../ui/Tooltip';
import { ToggleChip } from '../../ui/ToggleChip';
import { CopyLinkButton } from '../links/CopyLinkButton';
import { useCopyLinkCommand } from '../links/useCopyLinkCommand';
import { useNavigation } from '../navigation/navigationStore';
import { placeName } from '../shell/windowTitle';
import { PageContent } from '../navigation/pageRegistry';
import { usePageTitle } from '../navigation/usePageTitle';
import { useBackButtons } from '../navigation/useBackButtons';
import { SignInCover } from '../signIn/SignInCover';
import { Breadcrumb } from '../shell/Breadcrumb';
import { TopBar } from '../shell/TopBar';
import { useDiffExpansion } from '../shell/useDiffExpansion';
import { useWorkspaceWatcher } from '../shell/useWorkspaceWatcher';
import { usePlace, useWorkspaceInfo } from '../workspace/useWorkspace';
import { pageKey } from './followSelection';
import { pageWindowGoBack } from './pageWindowNavigation';
import { usePageWindow } from './pageWindowStore';
import { usePageWindowCommands } from './usePageWindowCommands';
import { setFollowingSelection, useFollowSelection } from './useFollowSelection';
import styles from './PageWindowScreen.module.css';

/**
 * A page window: one page of the place (a diff, a history…), opened from its window to read beside it, often on another
 * display. Its top bar says what it shows, copies a link to it, and offers to follow that window's selection. A
 * workspace's follows its disk (`WorkspaceWatch`); a repository explored without one has none.
 */
export function PageWindowScreen() {
  const pages = useNavigation((state) => state.pages);
  const inWorkspace = usePlace().kind === 'workspace';
  useFollowSelection();
  usePageWindowCommands();
  useDiffExpansion();
  useCopyLinkCommand();
  usePageWindowTitle();
  useShortcut(hotkey('back'), pageWindowGoBack);
  useBackButtons(pageWindowGoBack);
  const title = usePageTitle(pages.at(-1));
  const previousTitle = usePageTitle(pages.at(-2));

  const page = pages.at(-1);
  if (!page) return null;

  return (
    <div className={styles.screen}>
      {inWorkspace && <WorkspaceWatch />}
      <TopBar
        end={
          <>
            <CopyLinkButton page={page} />
            <FollowSelectionChip />
          </>
        }
      >
        <div className={styles.title}>
          <Breadcrumb back={previousTitle !== undefined ? { label: previousTitle, onClick: pageWindowGoBack } : undefined} current={title ?? ''} />
        </div>
      </TopBar>
      {/* Covered as its place's window is while the server needs a sign-in; a page window has no way home to offer. */}
      <SignInCover offersHome={false}>
        <main className={styles.content}>
          {/* Keyed by what it shows: a followed selection replaces the page with another of the same depth, whose state
              (a branch diff's selected changeset) mustn't carry over. */}
          <PageContent key={`${pages.length}:${pageKey(page)}`} page={page} />
        </main>
      </SignInCover>
    </div>
  );
}

/** Keeps a workspace's page in step with its disk (`useWorkspaceWatcher`), as its workspace window does. */
function WorkspaceWatch() {
  useWorkspaceWatcher();
  return null;
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

/**
 * "<page> — <workspace>", or "<page> — <repository>" for a repository explored without one (`placeName`): what the OS
 * lists the window as (the Window menu, Mission Control, the taskbar).
 */
function usePageWindowTitle(): void {
  const page = useNavigation((state) => state.pages.at(-1));
  const place = usePlace();
  const { data: workspace } = useWorkspaceInfo();
  const name = placeName(place, workspace);
  const title = usePageTitle(page);
  useEffect(() => {
    if (title !== undefined) document.title = name ? `${title} — ${name}` : title;
  }, [title, name]);
}
