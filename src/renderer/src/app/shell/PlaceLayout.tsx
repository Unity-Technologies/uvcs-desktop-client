import { Activity, useRef, type ReactNode } from 'react';
import { useDiffExpanded } from '../../components/diffExpansionStore';
import { SplitPane } from '../../ui/SplitPane';
import { Stowable } from '../../ui/Stowable';
import { useCopyLinkCommand } from '../links/useCopyLinkCommand';
import { showsMerge } from '../navigation/mergeInProgress';
import { useNavigation } from '../navigation/navigationStore';
import { viewLayers } from '../navigation/keptViews';
import { PageShownContext } from '../navigation/pageShown';
import { useOwnPageWindows } from '../pageWindow/useShowInFollowingWindow';
import { CommandLogPanel } from './CommandLogPanel';
import { COMMAND_LOG_HEIGHT, useCommandLogHost, useCommandLogStore } from './commandLogStore';
import { PageFrame } from './PageFrame';
import { Sidebar } from './Sidebar';
import { useDiffExpansion } from './useDiffExpansion';
import { useMainFocus } from './useMainFocus';
import { usePlaceCommands } from './usePlaceCommands';
import { useMergeRequestCommands } from '../../features/codeReviews/useMergeRequestCommands';
import styles from './PlaceLayout.module.css';
import { ViewShownContext } from '../../lib/viewShown';
import { KeptView } from './KeptView';
import { SignInCover } from '../signIn/SignInCover';

interface PlaceLayoutProps {
  /** The top bar: the workspace and its branch, or the repository explored and the way to make it a workspace. */
  topBar: ReactNode;
  statusBar: ReactNode;
}

/**
 * The screen of a place, a workspace or a repository explored without one (`WorkspaceScreen`, `RepositoryScreen`):
 * the top bar, the sidebar with the place's views, the view or the page on top of it, the command log under them, the
 * status bar. What every place has runs here: its commands (`usePlaceCommands`, `useMergeRequestCommands`), Copy link,
 * its command log and its page windows.
 */
export function PlaceLayout({ topBar, statusBar }: PlaceLayoutProps) {
  const { view, pages, merge, kept } = useNavigation();
  const commandLogOpen = useCommandLogStore((state) => state.open);
  const commandLogHeight = useCommandLogStore((state) => state.height);
  const setCommandLogHeight = useCommandLogStore((state) => state.setHeight);
  useCommandLogHost();
  usePlaceCommands();
  useMergeRequestCommands();
  useCopyLinkCommand();
  useOwnPageWindows();
  useDiffExpansion();
  const diffExpanded = useDiffExpanded();
  const contentRef = useRef<HTMLDivElement>(null);
  useMainFocus(contentRef);

  const mergeShown = showsMerge(merge, pages);

  return (
    <div className={styles.screen}>
      {topBar}
      <SignInCover>
        <div className={styles.body}>
          {/* An expanded diff takes the window but the top bar (the window's buttons, the place) and the command log. */}
          <Stowable stowed={diffExpanded}>
            <Sidebar />
          </Stowable>
          <main className={styles.main}>
            {/* The command log sits under the view, as tall as it was left; the view keeps the rest. */}
            <SplitPane
              direction="vertical"
              sizedPane="second"
              initialSize={COMMAND_LOG_HEIGHT.initial}
              minSize={COMMAND_LOG_HEIGHT.min}
              maxSize={COMMAND_LOG_HEIGHT.max}
              restMinSize={COMMAND_LOG_HEIGHT.restMin}
              size={commandLogHeight}
              onSizeChange={setCommandLogHeight}
              hidden={commandLogOpen ? undefined : 'second'}
              first={
                <div ref={contentRef} className={styles.content} data-diff-expanded={diffExpanded || undefined}>
                  {/* The views shown last stay mounted with their pages, hidden, as the user left them (`mountedViews`):
                      an Activity keeps what they show and stops their effects (shortcuts, watchers, reads). */}
                  {viewLayers(view, pages, kept, mergeShown).map((layer) => (
                    <Activity key={layer.view} mode={layer.shown ? 'visible' : 'hidden'}>
                      <KeptView view={layer.view} pages={layer.pages} drawsTop={layer.drawsTop} />
                    </Activity>
                  ))}
                  {/* A merge in progress stays mounted, shown or set aside, with all the user decided in it; set aside, no
                      shortcut inside it listens (`ViewShownContext`, read by `useShortcut`), its diffs' included. */}
                  {merge && (
                    <div key={`merge:${merge.id}`} className={styles.layer} hidden={!mergeShown}>
                      <PageShownContext.Provider value={mergeShown}>
                        <ViewShownContext.Provider value={mergeShown}>
                          <PageFrame page={merge.page} view={view} previous={pages.at(-2)} />
                        </ViewShownContext.Provider>
                      </PageShownContext.Provider>
                    </div>
                  )}
                </div>
              }
              second={<CommandLogPanel />}
            />
          </main>
        </div>
        <Stowable stowed={diffExpanded}>{statusBar}</Stowable>
      </SignInCover>
    </div>
  );
}
