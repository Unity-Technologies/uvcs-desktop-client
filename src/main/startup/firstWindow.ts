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
  early: Pick<EarlyCalls, 'start' | 'expireUntaken'>;
  commandLog: Pick<CommandLogRelay, 'windowsOpened'>;
}

/**
 * The first screen read ahead (`readFirstScreenAhead`): the workspace's, undefined for the home screen's; null when
 * none was, as the launch names a folder.
 */
export type FirstScreenRead = { workspacePath: string | undefined } | null;

/**
 * Starts what the first window shows on its way as the main module loads, before Electron is ready (50-60 ms later)
 * and before its window is created (50-100 ms more), as `cm` needs neither: `cm version`, and the first screen of the
 * workspace it reopens (or the home screen): its `cm shell`s, which answer their first command after about a second,
 * and its reads (`readFirstScreen`).
 *
 * A launch that names a folder (`namesAFolder`: Windows and Linux pass it as an argument) opens the workspace `cm`
 * finds holding it, so only `cm version` is read ahead, and the screen when the window opens. macOS names it later
 * (`open-file`), so there the last workspace's screen is read ahead anyway, and its answers expire unused
 * (`EARLY_ANSWER_MS`) while the window opens on the named one (`openFirstWindow`).
 */
export function readFirstScreenAhead({ cm, windows, early, settings }: FirstScreenSources, namesAFolder: boolean): FirstScreenRead {
  early.start('system.cmVersion', []);
  if (namesAFolder) return null;
  const workspacePath = windows.firstWorkspace();
  readScreenOf(workspacePath, { cm, early, settings });
  return { workspacePath };
}

/**
 * Opens the first window at launch (`openFirst`), its first screen read ahead (`readFirstScreenAhead`) unless that was
 * another or none, which is read now. The answers its page doesn't take then expire, and the commands logged before
 * it opened reach its command log.
 */
export function openFirstWindow({ cm, windows, early, settings, commandLog }: FirstWindow, readAhead: FirstScreenRead): void {
  const workspacePath = windows.firstWorkspace();
  if (readAhead === null || readAhead.workspacePath !== workspacePath) readScreenOf(workspacePath, { cm, early, settings });
  windows.openFirst();
  early.expireUntaken();
  commandLog.windowsOpened();
}

function readScreenOf(workspacePath: string | undefined, { cm, early, settings }: Omit<FirstScreenSources, 'windows'>): void {
  cm.warmUp(workspacePath);
  readFirstScreen(early, settings.get(), workspacePath);
}
