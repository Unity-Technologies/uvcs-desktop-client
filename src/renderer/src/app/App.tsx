import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useExternalApps } from '../components/externalApps/externalApps';
import { DialogHost } from '../ui/dialog/DialogHost';
import { ToastHost } from '../ui/toast/ToastHost';
import { TooltipLayer } from '../ui/TooltipLayer';
import { CommandPalette } from './commands/CommandPalette';
import { CommandShortcuts } from './commands/CommandShortcuts';
import { useAppCommands } from './commands/useAppCommands';
import { useMenuCommands } from './commands/useMenuCommands';
import { AppErrorBoundary } from './errors/AppErrorBoundary';
import { errorDetailsAction } from './errors/errorDetailsAction';
import { FolderDropTarget } from './folderDrop/FolderDropTarget';
import { HomeScreen } from './home/HomeScreen';
import { OperationCard } from './operations/OperationCard';
import { queryClient } from './queryClient';
import { useAppMenuKeys } from './shell/appMenu';
import { useSettingsFromOtherWindows } from './settings/useSettings';
import { useTheme } from './settings/useTheme';
import { GravatarPrompt } from './settings/GravatarPrompt';
import { useGravatarSetting } from './settings/useGravatarSetting';
import { CmUnavailableScreen } from './startup/CmUnavailableScreen';
import { ConnectionProblemCard } from './startup/ConnectionProblemCard';
import { SetupProblemScreen } from './startup/SetupProblemScreen';
import { useCmAvailability, useSetupCheck } from './startup/useCmAvailability';
import { UpdateCard } from './updates/UpdateCard';
import { loadUpdateStatus } from './updates/updateStore';
import { useSession } from './workspace/sessionStore';
import { useRequestedWorkspace } from './workspace/useRequestedWorkspace';
import { WorkspaceGate } from './workspace/WorkspaceGate';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Inside, so the dialogs and toasts outside it keep working once it shows its error screen. */}
      <AppErrorBoundary>
        <Root />
      </AppErrorBoundary>
      <CommandPalette />
      <CommandShortcuts />
      <DialogHost />
      <ToastHost errorAction={errorDetailsAction} renderOperation={(toast, dismiss) => <OperationCard toast={toast} dismiss={dismiss} />}>
        <ConnectionProblemCard />
        <GravatarPrompt />
        <UpdateCard />
      </ToastHost>
      <TooltipLayer />
    </QueryClientProvider>
  );
}

function Root() {
  useTheme();
  useGravatarSetting();
  useSettingsFromOtherWindows();
  useExternalApps();
  useAppCommands();
  useMenuCommands();
  useAppMenuKeys();
  useRequestedWorkspace();
  useEffect(() => void loadUpdateStatus(), []);
  const workspacePath = useSession((state) => state.workspacePath);
  const cm = useCmAvailability();
  const setup = useSetupCheck(cm.isSuccess);

  if (cm.error) return <CmUnavailableScreen reason={cm.error.message} checking={cm.isFetching} onRecheck={() => void cm.refetch()} />;
  // The app shows meanwhile: the check is local and takes a moment. A server out of reach never stops the app: the
  // open workspace's server is checked apart (`ConnectionProblemCard`), and the home screen asks no server at all.
  if (setup.data) {
    return <SetupProblemScreen problem={setup.data} checking={setup.isFetching} onRetry={() => void setup.refetch()} />;
  }
  return (
    <>
      {workspacePath ? <WorkspaceGate key={workspacePath} /> : <HomeScreen />}
      <FolderDropTarget />
    </>
  );
}
