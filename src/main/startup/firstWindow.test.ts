import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { openFirstWindow, readFirstScreenAhead } from './firstWindow';

const SETTINGS = { ...DEFAULT_SETTINGS, pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, showPrivate: false } };

interface Launch {
  /** The workspace the first window opens as the main module loads (none: the home screen). */
  atLoad: string | undefined;
  /** The one it opens once Electron is ready and the launch's own request is known. */
  atOpen?: string | undefined;
  /** Whether the launch names a folder on its command line (Windows, Linux), known as the main module loads. */
  namesAFolder?: boolean;
  /** Starting an early read fails (`EarlyCalls.start`). */
  readsFail?: boolean;
}

/** A launch of the app; returns what happened, in order. */
function launch({ atLoad, atOpen = atLoad, namesAFolder = false, readsFail = false }: Launch): string[] {
  const steps: string[] = [];
  let firstWorkspace = atLoad;
  let failing = readsFail;
  const sources = {
    cm: {
      warmUp: (cwd?: string) => void steps.push(`warm up ${cwd ?? 'the home folder'}`),
      showWhileOpening: (cwd: string) => void steps.push(`show ${cwd} while it opens`),
    },
    windows: { firstWorkspace: () => firstWorkspace, openFirst: () => void steps.push('open the window') },
    early: {
      start: (method: string, args: unknown[]) => {
        if (failing) throw new Error('no such method');
        steps.push(`read ${method} ${JSON.stringify(args)}`);
      },
      expireUntaken: () => void steps.push('let untaken answers expire'),
    },
    settings: { get: () => SETTINGS },
    commandLog: { windowsOpened: () => void steps.push('send the commands logged so far') },
  };
  const readAhead = readFirstScreenAhead(sources, namesAFolder);
  steps.push('Electron ready');
  firstWorkspace = atOpen;
  failing = false;
  openFirstWindow(sources, readAhead);
  return steps;
}

const CM_VERSION = 'read system.cmVersion []';
const WORKSPACE_READS = (workspacePath: string): string[] => [
  `show ${workspacePath} while it opens`,
  `read workspaces.info ${JSON.stringify([workspacePath])}`,
  `read pendingChanges.list ${JSON.stringify([workspacePath, SETTINGS.pendingChanges])}`,
];
const OPENED = ['open the window', 'let untaken answers expire', 'send the commands logged so far'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the first window', () => {
  it("starts the workspace's cm shells, shown while it opens, and its Changes view's reads before Electron is ready", () => {
    expect(launch({ atLoad: '/wk' })).toEqual([CM_VERSION, ...WORKSPACE_READS('/wk'), 'Electron ready', ...OPENED]);
  });

  it("starts the home folder's cm shells and the home screen's reads before Electron is ready", () => {
    expect(launch({ atLoad: undefined })).toEqual([
      CM_VERSION,
      'warm up the home folder',
      'read workspaces.list []',
      'read repositories.servers []',
      'Electron ready',
      ...OPENED,
    ]);
  });

  it('reads ahead only what no workspace decides when the launch names a folder, and the workspace found as the window opens', () => {
    expect(launch({ atLoad: '/last', atOpen: '/named', namesAFolder: true })).toEqual([
      CM_VERSION,
      'Electron ready',
      ...WORKSPACE_READS('/named'),
      ...OPENED,
    ]);
  });

  it('reads the workspace a launch names when the window opens, as the one read ahead was another (macOS: known only later)', () => {
    expect(launch({ atLoad: '/last', atOpen: '/named' })).toEqual([
      CM_VERSION,
      ...WORKSPACE_READS('/last'),
      'Electron ready',
      ...WORKSPACE_READS('/named'),
      ...OPENED,
    ]);
  });

  it('still opens the window, reading its screen then, when reading ahead fails', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(launch({ atLoad: '/wk', readsFail: true })).toEqual(['Electron ready', ...WORKSPACE_READS('/wk'), ...OPENED]);
    expect(console.warn).toHaveBeenCalledOnce();
  });
});
