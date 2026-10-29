import { BrowserWindow, dialog, type MessageBoxOptions } from 'electron';
import { focusWindow } from './WorkspaceWindows';

const QUESTION: MessageBoxOptions = {
  type: 'question',
  message: 'Close when the operation finishes?',
  detail: 'An operation is still changing the workspace. The window stays open until it finishes.',
  buttons: ['Close When Finished', 'Cancel'],
  defaultId: 0,
  cancelId: 1,
  noLink: true,
};

/**
 * Asks, over the window brought forward, whether to close it once the operation changing its workspace finishes
 * (`ClosingWithWrites`). The OS's own message box, as quitting asks (`askToQuitWhenDone`): the close may come from the
 * taskbar or the Window menu while the window is in the background, and the answer is the main process's.
 */
export async function askToCloseWhenDone(windowId: number): Promise<boolean> {
  const window = BrowserWindow.fromId(windowId);
  if (!window || window.isDestroyed()) return false;
  focusWindow(window);
  const { response } = await dialog.showMessageBox(window, QUESTION);
  return response === 0;
}
