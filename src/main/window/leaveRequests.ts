import { app, BrowserWindow } from 'electron';
import { sendEventTo } from '../ipc/sendEvent';
import { focusWindow } from './WorkspaceWindows';

/** Windows asked to close (their own close or quitting) whose page held on to unsaved edits. */
const closing = new Set<number>();
let quitting = false;

app.on('before-quit', () => {
  quitting = true;
});

/**
 * A page with unsaved edits holds its unloading back (`beforeunload`), whatever unloads it: closing its window,
 * quitting, reloading. The window then comes forward and its page asks Save / Don't save / Cancel like leaving a file
 * does (`leaveRequested`), and says what was chosen with `continueLeaving`.
 */
export function askBeforeUnloading(window: BrowserWindow): void {
  const viewer = window.webContents.id;
  // Comes before the page's `beforeunload`, which may hold the close back.
  window.on('close', () => closing.add(viewer));
  window.on('closed', () => closing.delete(viewer));
  window.webContents.on('will-prevent-unload', () => {
    focusWindow(window);
    sendEventTo(window.webContents, 'leaveRequested', {});
  });
}

/** The page settled its unsaved edits (saved or dropped them): what unloaded it goes on. Otherwise nothing does. */
export function continueLeaving(viewer: number, canLeave: boolean): void {
  const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.id === viewer);
  if (!window || window.isDestroyed()) return;
  const wasClosing = closing.delete(viewer);
  if (!canLeave) {
    quitting = false;
    return;
  }
  if (quitting) app.quit();
  else if (wasClosing) window.close();
  else window.webContents.reload();
}
