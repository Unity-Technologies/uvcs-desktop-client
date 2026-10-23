import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { isMenuCommandEnabled, REPOSITORY_MENU_COMMANDS, WORKSPACE_MENU_COMMANDS } from './workspaceMenuCommands';

const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');
const menuCommands = [...read('appMenuTemplate.ts').matchAll(/commandItem\([^,]+, '([^']+)'/g)].map(([, id]) => id);
const WORKSPACE_COMMAND_SOURCES = [
  '../../renderer/src/app/shell/useWorkspaceCommands.ts',
  '../../renderer/src/features/branches/useBranchCommands.ts',
  '../../renderer/src/features/merge/useMergeCommands.ts',
];
// The home screen registers some of the same ids (Home, Open Workspace…, Refresh): those work in every window.
const HOME_COMMAND_SOURCES = ['../../renderer/src/app/home/useHomeCommands.ts'];
const commandIdsIn = (sources: string[]) => new Set(sources.flatMap((source) => [...read(source).matchAll(/id: '([^']+)'/g)].map(([, id]) => id)));
const homeCommands = commandIdsIn(HOME_COMMAND_SOURCES);
const workspaceCommands = new Set([...commandIdsIn(WORKSPACE_COMMAND_SOURCES)].filter((id) => !homeCommands.has(id)));

describe('workspace menu commands', () => {
  it('are the menu items whose command only a workspace registers', () => {
    expect([...new Set(menuCommands.filter((id) => workspaceCommands.has(id)))].sort()).toEqual([...WORKSPACE_MENU_COMMANDS].sort());
  });

  it('are disabled on the home screen and enabled in a workspace; the others always are', () => {
    expect(isMenuCommandEnabled('branch.switch', undefined)).toBe(false);
    expect(isMenuCommandEnabled('branch.switch', workspacePlace('/wk'))).toBe(true);
    expect(isMenuCommandEnabled('app.settings', undefined)).toBe(true);
    expect(isMenuCommandEnabled('app.home', undefined)).toBe(true);
    expect(isMenuCommandEnabled('workspace.open', undefined)).toBe(true);
  });

  it('are enabled in a repository explored without a workspace only where they need no disk', () => {
    const repository = repositoryPlace('game@local');
    expect(WORKSPACE_MENU_COMMANDS.filter((id) => isMenuCommandEnabled(id, repository))).toEqual(['app.commandLog', 'branch.new']);
    expect(REPOSITORY_MENU_COMMANDS.every((id) => WORKSPACE_MENU_COMMANDS.includes(id))).toBe(true);
  });
});
