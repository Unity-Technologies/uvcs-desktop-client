import { QueryClientProvider } from '@tanstack/react-query';
import { DialogHost } from '../ui/dialog/DialogHost';
import { ToastHost } from '../ui/toast/ToastHost';
import { TooltipLayer } from '../ui/TooltipLayer';
import { CommandPalette } from './commands/CommandPalette';
import { CommandShortcuts } from './commands/CommandShortcuts';
import { useAppCommands } from './commands/useAppCommands';
import { useMenuCommands } from './commands/useMenuCommands';
import { errorDetailsAction } from './errors/errorDetailsAction';
import { HomeScreen } from './home/HomeScreen';
import { queryClient } from './queryClient';
import { useTheme } from './settings/useTheme';
import { CmUnavailableScreen } from './startup/CmUnavailableScreen';
import { useCmAvailability } from './startup/useCmAvailability';
import { useSession } from './workspace/sessionStore';
import { WorkspaceGate } from './workspace/WorkspaceGate';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Root />
      <CommandPalette />
      <CommandShortcuts />
      <DialogHost />
      <ToastHost errorAction={errorDetailsAction} />
      <TooltipLayer />
    </QueryClientProvider>
  );
}

function Root() {
  useTheme();
  useAppCommands();
  useMenuCommands();
  const workspacePath = useSession((state) => state.workspacePath);
  const cm = useCmAvailability();

  if (cm.error) return <CmUnavailableScreen reason={cm.error.message} onRetry={() => void cm.refetch()} />;
  return workspacePath ? <WorkspaceGate key={workspacePath} /> : <HomeScreen />;
}
