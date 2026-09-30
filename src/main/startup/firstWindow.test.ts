import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import { openFirstWindow } from './firstWindow';

const SETTINGS = { ...DEFAULT_SETTINGS, pendingChanges: { ...DEFAULT_SETTINGS.pendingChanges, showPrivate: false } };

/** Opens the first window on `workspacePath` (none: the home screen) and returns what happened, in order. */
function openFirstOn(workspacePath: string | undefined): string[] {
  const steps: string[] = [];
  openFirstWindow({
    cm: { warmUp: (cwd) => void steps.push(`warm up ${cwd ?? 'the home folder'}`) },
    windows: { firstWorkspace: () => workspacePath, openFirst: () => void steps.push('open the window') },
    early: { start: (method, args) => void steps.push(`read ${method} ${JSON.stringify(args)}`) },
    settings: { get: () => SETTINGS },
  });
  return steps;
}

describe('openFirstWindow', () => {
  it("starts the workspace's cm shells and its Changes view's reads before creating the window", () => {
    expect(openFirstOn('/wk')).toEqual([
      'warm up /wk',
      'read system.cmVersion []',
      'read workspaces.info ["/wk"]',
      `read pendingChanges.list ${JSON.stringify(['/wk', SETTINGS.pendingChanges])}`,
      'open the window',
    ]);
  });

  it("starts the home folder's cm shells and the home screen's reads before creating a window on the home screen", () => {
    expect(openFirstOn(undefined)).toEqual([
      'warm up the home folder',
      'read system.cmVersion []',
      'read workspaces.list []',
      'read repositories.servers []',
      'open the window',
    ]);
  });
});
