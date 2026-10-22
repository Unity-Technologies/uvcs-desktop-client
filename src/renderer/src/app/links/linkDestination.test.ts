import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRepository, linkDestination, type DestinationContext } from './linkDestination';

const GAME = join('/wk', 'game');
const GAME_TASK = join('/wk', 'game-task');
const TOOLS = join('/wk', 'tools');
const LINK = { server: 'acme@unity', repository: 'game' };

function context(overrides: Partial<DestinationContext>): DestinationContext {
  return { current: null, workspaces: [], shown: [], recent: [], ...overrides };
}

describe('linkDestination', () => {
  it("opens in this window when its workspace is on the repository, even when others are", () => {
    const game = { path: GAME, repository: 'game@acme@unity' };
    expect(linkDestination(LINK, context({ current: game, workspaces: [game, { path: GAME_TASK, repository: 'game@acme@unity' }], shown: [GAME_TASK] }))).toEqual({ kind: 'here' });
  });

  it('goes to the window showing a workspace on it, the last focused first', () => {
    const workspaces = [
      { path: GAME, repository: 'game@acme@unity' },
      { path: GAME_TASK, repository: 'game@acme@unity' },
      { path: TOOLS, repository: 'tools@acme@unity' },
    ];
    expect(linkDestination(LINK, context({ current: workspaces[2], workspaces, shown: [TOOLS, GAME_TASK, GAME] }))).toEqual({ kind: 'workspace', path: GAME_TASK });
  });

  it('opens the only workspace on it', () => {
    expect(linkDestination(LINK, context({ workspaces: [{ path: GAME, repository: 'game@acme@unity' }, { path: TOOLS, repository: null }] }))).toEqual({ kind: 'workspace', path: GAME });
  });

  it('asks which of several, the most recently used first', () => {
    const workspaces = [
      { path: GAME, repository: 'game@acme@unity' },
      { path: GAME_TASK, repository: 'game@acme@unity' },
    ];
    expect(linkDestination(LINK, context({ workspaces, recent: [TOOLS, GAME_TASK] }))).toEqual({ kind: 'pick', paths: [GAME_TASK, GAME] });
  });

  it('finds none when no workspace is on it, nor one cm could not tell', () => {
    expect(linkDestination(LINK, context({ workspaces: [{ path: TOOLS, repository: 'tools@acme@unity' }, { path: GAME, repository: null }] }))).toEqual({ kind: 'none' });
  });
});

describe('isRepository', () => {
  it('matches the name in any case and the server whatever its protocol', () => {
    expect(isRepository('Game@ACME@unity', LINK)).toBe(true);
    expect(isRepository('game@ssl://host:8088', { server: 'host:8088', repository: 'game' })).toBe(true);
    expect(isRepository('art/textures@local', { server: 'local', repository: 'art/textures' })).toBe(true);
  });

  it('tells apart another repository, or the same name on another server', () => {
    expect(isRepository('game-art@acme@unity', LINK)).toBe(false);
    expect(isRepository('game@other@unity', LINK)).toBe(false);
    expect(isRepository('game@acme@cloud', LINK)).toBe(false);
  });
});
