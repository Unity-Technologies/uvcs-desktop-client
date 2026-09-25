import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { DialogHost } from '../ui/dialog/DialogHost';
import { ToastHost } from '../ui/toast/ToastHost';
import { TooltipLayer } from '../ui/TooltipLayer';
import { CommandPalette } from './commands/CommandPalette';
import { CommandShortcuts } from './commands/CommandShortcuts';
import { useAppCommands } from './commands/useAppCommands';
import { useMenuCommands } from './commands/useMenuCommands';
import { errorDetailsAction } from './errors/errorDetailsAction';
import { HomeScreen } from './home/HomeScreen';
import { OperationCard } from './operations/OperationCard';
import { queryClient } from './queryClient';
import { useSettingsFromOtherWindows } from './settings/useSettings';
import { useTheme } from './settings/useTheme';
import { CmUnavailableScreen } from './startup/CmUnavailableScreen';
import { SetupProblemScreen } from './startup/SetupProblemScreen';
import { useCmAvailability, useSetupCheck } from './startup/useCmAvailability';
import { useSession } from './workspace/sessionStore';
import { useRequestedWorkspace } from './workspace/useRequestedWorkspace';
import { WorkspaceGate } from './workspace/WorkspaceGate';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
      <CommandPalette />
      <CommandShortcuts />
      <DialogHost />
      <ToastHost errorAction={errorDetailsAction} renderOperation={(toast, dismiss) => <OperationCard toast={toast} dismiss={dismiss} />} />
      <TooltipLayer />
    </QueryClientProvider>
  );
}

function Root() {
  useTheme();
  useSettingsFromOtherWindows();
  useAppCommands();
  useMenuCommands();
  useRequestedWorkspace();
  const workspacePath = useSession((state) => state.workspacePath);
  const cm = useCmAvailability();
  const setup = useSetupCheck(cm.isSuccess);
  const [setupProblemDismissed, dismissSetupProblem] = useState(false);

  if (cm.error) return <CmUnavailableScreen reason={cm.error.message} checking={cm.isFetching} onRecheck={() => void cm.refetch()} />;
  // The app shows meanwhile: the check takes a moment, or up to its timeout when the server doesn't answer.
  if (setup.data && !setupProblemDismissed) {
    return (
      <SetupProblemScreen
        problem={setup.data}
        checking={setup.isFetching}
        onRetry={() => void setup.refetch()}
        onContinue={() => dismissSetupProblem(true)}
      />
    );
  }
  return workspacePath ? <WorkspaceGate key={workspacePath} /> : <HomeScreen />;
}
