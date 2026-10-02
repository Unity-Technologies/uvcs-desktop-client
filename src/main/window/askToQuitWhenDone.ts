import { BrowserWindow, dialog, type MessageBoxOptions } from 'electron';

const QUESTION: MessageBoxOptions = {
  type: 'question',
  message: 'Quit when the operation finishes?',
  detail: 'An operation is still changing the workspace. Quitting now would stop it partway.',
  buttons: ['Quit When Finished', 'Cancel'],
  defaultId: 0,
  cancelId: 1,
  noLink: true,
};

/**
 * Asks, over the focused window (else the last one), whether to quit once the operation changing the workspace finishes
 * (`Quitting`). The OS's own message box rather than the page's dialog: the quit may come from a window other than the
 * one running the operation, or from the Dock, and the answer is the main process's.
 */
export async function askToQuitWhenDone(): Promise<boolean> {
  const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().at(-1);
  const { response } = await (window ? dialog.showMessageBox(window, QUESTION) : dialog.showMessageBox(QUESTION));
  return response === 0;
}
