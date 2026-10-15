import type { AppSettings } from '@shared/domain/settings';
import type { CmClient } from '../cm/CmClient';
import type { EarlyCalls } from '../ipc/EarlyCalls';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import type { CommandLogRelay } from './commandLogRelay';
import { readFirstScreen } from './firstScreenReads';

interface FirstScreenSources {
  cm: Pick<CmClient, 'warmUp'>;
  windows: Pick<WorkspaceWindows, 'firstWorkspace'>;
  early: Pick<EarlyCalls, 'start'>;
  settings: { get(): AppSettings };
}

interface FirstWindow extends FirstScreenSources {
  windows: Pick<WorkspaceWindows, 'firstWorkspace' | 'openFirst'>;
  commandLog: Pick<CommandLogRelay, 'windowsOpened'>;
}

/** The workspace whose first screen is on its way (`readFirstScreenAhead`); undefined for the home screen. */
export interface FirstScreenRead {
  workspacePath: string | undefined;
}

/**
 * Starts what the first window shows on its way as the main module loads, before Electron is ready (50-60 ms later)
 * and before its window is created (50-100 ms more), as `cm` needs neither: the `cm shell`s of the workspace it
 * reopens, or of the home folder for the home screen, which answer their first command after about a second; and its
 * first screen's reads (`readFirstScreen`). A launch that names another workspace (`requestAtLaunch`, known only
 * later) reads that one when the window opens (`openFirstWindow`), and these answers expire unused (`EARLY_ANSWER_MS`).
 */
export function readFirstScreenAhead({ cm, windows, early, settings }: FirstScreenSources): FirstScreenRead {
  const workspacePath = windows.firstWorkspace();
  readFirstScreenOf(workspacePath, { cm, early, settings });
  return { workspacePath };
}

/**
 * Opens the first window at launch (`openFirst`), its first screen read ahead (`readFirstScreenAhead`) unless the
 * launch named another workspace, which is read now. The commands logged before it opened then reach its command log.
 */
export function openFirstWindow({ cm, windows, early, settings, commandLog }: FirstWindow, readAhead: FirstScreenRead): void {
  const workspacePath = windows.firstWorkspace();
  if (workspacePath !== readAhead.workspacePath) readFirstScreenOf(workspacePath, { cm, early, settings });
  windows.openFirst();
  commandLog.windowsOpened();
}

function readFirstScreenOf(workspacePath: string | undefined, { cm, early, settings }: Omit<FirstScreenSources, 'windows'>): void {
  cm.warmUp(workspacePath);
  readFirstScreen(early, settings.get(), workspacePath);
}
