import { BrowserWindow, webContents } from 'electron';
import type { WindowsApi } from '@shared/api/windows';
import { callerId } from '../ipc/caller';
import { popUpAppMenu } from '../window/appMenu';
import { continueLeaving } from '../window/leaveRequests';
import { focusWindow } from '../window/WorkspaceWindows';
import type { ServiceContext } from './ServiceContext';

export function createWindowsService({ windows, handedOverDiffs }: ServiceContext): WindowsApi {
  return {
    openPlace: async (place) => windows.showPlace(place),
    focusPlace: async (place) => {
      const other = windows.windowShowing(place, callerId());
      if (other) focusWindow(other);
      return Boolean(other);
    },
    exploring: async (repository) => windows.repositoryShown(callerId(), repository ?? undefined),
    openHome: async () => void windows.open(),
    continueLeaving: async (canLeave) => continueLeaving(callerId(), canLeave),
    viewShown: async (view) => windows.viewShown(callerId(), view),
    showAppMenu: async (position) => {
      const caller = webContents.fromId(callerId());
      const window = caller && BrowserWindow.fromWebContents(caller);
      if (window) popUpAppMenu(window, position);
    },
    openPage: async ({ place, page, diff, seed }) => {
      if (diff) handedOverDiffs.hand(place, diff.target, diff.entries);
      windows.openPage(callerId(), { place, page, seed });
    },
    followSelection: async (following) => windows.follow(callerId(), following),
    selectionShown: async (page, seed) => windows.selectionShown(callerId(), page, seed),
    showWorkspaceWindow: async (commandId) => windows.showWorkspaceWindow(callerId(), commandId),
    openPageInWorkspaceWindow: async (page) => windows.openInWorkspaceWindow(callerId(), page),
    takeLink: async () => windows.takeLink(callerId()),
    openLinkIn: async (place, link) => windows.openLinkIn(callerId(), place, link),
    shownWorkspaces: async () => windows.shownWorkspaces(),
  };
}
