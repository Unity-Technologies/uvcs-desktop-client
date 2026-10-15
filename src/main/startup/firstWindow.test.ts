import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { openFirstWindow, readFirstScreenAhead } from './firstWindow';

const SETTINGS = { ...DEFAULT_SETTINGS, pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, showPrivate: false } };

/**
 * A launch whose first window opens on `atLoad` as the main module loads, and on `atOpen` once Electron is ready and
 * the launch's own request is known (none: the home screen). Returns what happened, in order.
 */
function launch(atLoad: string | undefined, atOpen: string | undefined = atLoad): string[] {
  const steps: string[] = [];
  let firstWorkspace = atLoad;
  const sources = {
    cm: { warmUp: (cwd?: string) => void steps.push(`warm up ${cwd ?? 'the home folder'}`) },
    windows: { firstWorkspace: () => firstWorkspace, openFirst: () => void steps.push('open the window') },
    early: { start: (method: string, args: unknown[]) => void steps.push(`read ${method} ${JSON.stringify(args)}`) },
    settings: { get: () => SETTINGS },
    commandLog: { windowsOpened: () => void steps.push('send the commands logged so far') },
  };
  const readAhead = readFirstScreenAhead(sources);
  steps.push('Electron ready');
  firstWorkspace = atOpen;
  openFirstWindow(sources, readAhead);
  return steps;
}

const WORKSPACE_READS = (workspacePath: string): string[] => [
  `warm up ${workspacePath}`,
  'read system.cmVersion []',
  `read workspaces.info ${JSON.stringify([workspacePath])}`,
  `read pendingChanges.list ${JSON.stringify([workspacePath, SETTINGS.pendingChanges])}`,
];

describe('the first window', () => {
  it("starts the workspace's cm shells and its Changes view's reads before Electron is ready", () => {
    expect(launch('/wk')).toEqual([...WORKSPACE_READS('/wk'), 'Electron ready', 'open the window', 'send the commands logged so far']);
  });

  it("starts the home folder's cm shells and the home screen's reads before Electron is ready", () => {
    expect(launch(undefined)).toEqual([
      'warm up the home folder',
      'read system.cmVersion []',
      'read workspaces.list []',
      'read repositories.servers []',
      'Electron ready',
      'open the window',
      'send the commands logged so far',
    ]);
  });

  it('reads the workspace a launch names when the window opens, as the one read ahead was another', () => {
    expect(launch('/last', '/named')).toEqual([
      ...WORKSPACE_READS('/last'),
      'Electron ready',
      ...WORKSPACE_READS('/named'),
      'open the window',
      'send the commands logged so far',
    ]);
  });
});
