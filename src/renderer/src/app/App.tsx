import { QueryClientProvider } from '@tanstack/react-query';
import { DialogHost } from '../ui/dialog/DialogHost';
import { ToastHost } from '../ui/toast/ToastHost';
import { TooltipProvider } from '../ui/Tooltip';
import { CommandPalette } from './commands/CommandPalette';
import { CommandShortcuts } from './commands/CommandShortcuts';
import { useAppCommands } from './commands/useAppCommands';
import { useMenuCommands } from './commands/useMenuCommands';
import { HomeScreen } from './home/HomeScreen';
import { queryClient } from './queryClient';
import { useTheme } from './settings/useTheme';
import { WorkspaceScreen } from './shell/WorkspaceScreen';
import { useSession } from './workspace/sessionStore';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={500}>
        <Root />
        <CommandPalette />
        <CommandShortcuts />
        <DialogHost />
        <ToastHost />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function Root() {
  useTheme();
  useAppCommands();
  useMenuCommands();
  const workspacePath = useSession((state) => state.workspacePath);
  return workspacePath ? <WorkspaceScreen key={workspacePath} /> : <HomeScreen />;
}
