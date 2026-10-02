import { app } from 'electron';
import { quitStarted } from '../window/leaveRequests';

/**
 * What happens as the app quits, in one `before-quit` listener, so each step knows whether an earlier one held the quit
 * back: the pages hear it (`quitStarted`), so one holding unsaved edits quits the app once it settles them.
 */
export class Quitting {
  /** Electron's `before-quit`. */
  beforeQuit(): void {
    quitStarted();
  }
}

/** Listens to the app's quit (`Quitting`). */
export function handleQuitting(quitting: Quitting): void {
  app.on('before-quit', () => quitting.beforeQuit());
}
