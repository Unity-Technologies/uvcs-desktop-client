import type { AppSettings } from '@shared/domain/settings';
import type { CmClient } from '../cm/CmClient';
import type { EarlyCalls } from '../ipc/EarlyCalls';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import { readFirstScreen } from './firstScreenReads';

interface FirstWindow {
  cm: Pick<CmClient, 'warmUp'>;
  windows: Pick<WorkspaceWindows, 'firstWorkspace' | 'openFirst'>;
  early: Pick<EarlyCalls, 'start'>;
  settings: { get(): AppSettings };
}

/**
 * Opens the first window at launch (`openFirst`) with what it shows already on its way, started before the window is
 * created (which takes 50-100 ms, and its page as much again before it asks for anything): the `cm shell`s of its
 * workspace, or of the home folder for the home screen, which answer their first command after about a second; and
 * its first screen's reads (`readFirstScreen`).
 */
export function openFirstWindow({ cm, windows, early, settings }: FirstWindow): void {
  const workspacePath = windows.firstWorkspace();
  cm.warmUp(workspacePath);
  readFirstScreen(early, settings.get(), workspacePath);
  windows.openFirst();
}
