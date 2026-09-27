import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isMenuCommandEnabled, WORKSPACE_MENU_COMMANDS } from './workspaceMenuCommands';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');
const menuCommands = [...read('appMenu.ts').matchAll(/commandItem\('[^']+', '([^']+)'/g)].map(([, id]) => id);
const workspaceCommands = new Set([...read('../../renderer/src/app/shell/useWorkspaceCommands.ts').matchAll(/id: '([^']+)'/g)].map(([, id]) => id));

describe('workspace menu commands', () => {
  it('are the menu items whose command only a workspace registers', () => {
    expect([...new Set(menuCommands.filter((id) => workspaceCommands.has(id)))].sort()).toEqual([...WORKSPACE_MENU_COMMANDS].sort());
  });

  it('are disabled on the home screen and enabled in a workspace; the others always are', () => {
    expect(isMenuCommandEnabled('workspace.update', false)).toBe(false);
    expect(isMenuCommandEnabled('workspace.update', true)).toBe(true);
    expect(isMenuCommandEnabled('app.settings', false)).toBe(true);
  });
});
