import { useIncomingNotificationClicks } from '../../features/incoming/incomingNotifications';
import { useKeptAsideNotice } from '../../features/leftChanges/keptAsideNotice';
import { useMergeCommands } from '../../features/merge/useMergeCommands';
import { PlaceLayout } from './PlaceLayout';
import { WorkspaceStatusBar } from './StatusBar';
import { useWindowTitle } from './useWindowTitle';
import { useWorkspaceCommands } from './useWorkspaceCommands';
import { useWorkspaceWatcher } from './useWorkspaceWatcher';
import { WorkspaceSidebarCard } from './WorkspaceSidebarCard';
import { WorkspaceTopBar } from './WorkspaceTopBar';

/** A workspace's screen: every place's layout (`PlaceLayout`), with what only a workspace has: its disk watched, its commands, its merges. */
export function WorkspaceScreen() {
  useWorkspaceWatcher();
  useWorkspaceCommands();
  useWindowTitle();
  useMergeCommands();
  useIncomingNotificationClicks();
  useKeptAsideNotice();

  return <PlaceLayout topBar={<WorkspaceTopBar />} sidebarCard={<WorkspaceSidebarCard />} statusBar={<WorkspaceStatusBar />} />;
}
