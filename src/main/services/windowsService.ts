import type { WindowsApi } from '@shared/api/windows';
import { callerId } from '../ipc/caller';
import { continueLeaving } from '../window/leaveRequests';
import { focusWindow } from '../window/WorkspaceWindows';
import type { ServiceContext } from './ServiceContext';

export function createWindowsService({ windows }: ServiceContext): WindowsApi {
  return {
    openWorkspace: async (workspacePath) => windows.showWorkspace(workspacePath),
    focusWorkspace: async (workspacePath) => {
      const other = windows.windowShowing(workspacePath, callerId());
      if (other) focusWindow(other);
      return Boolean(other);
    },
    openHome: async () => void windows.open(),
    continueLeaving: async (canLeave) => continueLeaving(callerId(), canLeave),
  };
}
