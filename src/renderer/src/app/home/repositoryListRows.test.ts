import { describe, expect, it } from 'vitest';
import type { RepositorySummary } from '@shared/domain/repository';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import { countCalls } from '@shared/testing/countCalls';
import { matchingRepositories, movesBetweenRows, repositoryListRows, repositoryRowIndex, repositoryRowKey, repositoryRowKeyTarget, workspacesByRepository, type RepositoryListRow } from './repositoryListRows';

const repository = (name: string): RepositorySummary => ({ id: name, name, server: 'local', owner: 'ana', spec: `${name}@local` });
const workspace = (name: string): WorkspaceSummary => ({ name, path: `/work/${name}`, guid: name });

const game = repository('game');
const tools = repository('tools');
const art = repository('art');
const gameWk = workspace('game-wk');
const gameHotfix = workspace('game-hotfix');
const toolsWk = workspace('tools-wk');

/** A row as words: what it is and what it names. */
const described = (row: RepositoryListRow): string =>
  row.kind === 'repository' ? `${row.repository.name}${row.expanded ? ' (open)' : ''}: ${row.workspaces.length}` : row.kind === 'workspace' ? `  ${row.workspace.name}` : `  + ${row.repository.name}`;

describe('workspacesByRepository', () => {
  it('gathers the workspaces of each repository, leaving out those whose repository is unknown', () => {
    const byRepository = workspacesByRepository([
      { workspace: gameWk, repository: game.spec },
      { workspace: toolsWk, repository: tools.spec },
      { workspace: workspace('somewhere'), repository: null },
      { workspace: workspace('resolving') },
      { workspace: gameHotfix, repository: game.spec },
    ]);
    expect(Object.fromEntries([...byRepository].map(([spec, workspaces]) => [spec, workspaces.map((each) => each.name)]))).toEqual({
      'game@local': ['game-wk', 'game-hotfix'],
      'tools@local': ['tools-wk'],
    });
  });
});

describe('matchingRepositories', () => {
  const repositories = [game, repository('game-art'), tools];

  it('keeps those whose name holds every word typed, in any order and case', () => {
    expect(matchingRepositories(repositories, 'ART Game').map((each) => each.name)).toEqual(['game-art']);
    expect(matchingRepositories(repositories, 'nothing')).toEqual([]);
  });

  it('keeps every one for a blank filter', () => {
    expect(matchingRepositories(repositories, '  ')).toEqual(repositories);
  });
});

describe('repositoryListRows', () => {
  const workspaces = workspacesByRepository([
    { workspace: gameWk, repository: game.spec },
    { workspace: gameHotfix, repository: game.spec },
    { workspace: toolsWk, repository: tools.spec },
  ]);

  it('lists the repositories, each with how many workspaces it has', () => {
    expect(repositoryListRows([art, game, tools], workspaces, new Set()).map(described)).toEqual(['art: 0', 'game: 2', 'tools: 1']);
  });

  it('lists the workspaces of an expanded repository under it, then the action to add one', () => {
    expect(repositoryListRows([art, game, tools], workspaces, new Set([game.spec, art.spec])).map(described)).toEqual([
      'art (open): 0',
      '  + art',
      'game (open): 2',
      '  game-wk',
      '  game-hotfix',
      '  + game',
      'tools: 1',
    ]);
  });

  it("looks each repository's workspaces up once, not through every workspace", () => {
    const many = Array.from({ length: 2_000 }, (_, index) => repository(`repo-${index}`));
    const index = workspacesByRepository(many.map((each, at) => ({ workspace: workspace(`wk-${at}`), repository: each.spec })));

    const { result: rows, calls } = countCalls(index, 'get', () => repositoryListRows(many, index, new Set()));

    expect(rows).toHaveLength(2_000);
    expect(calls).toBe(2_000);
  });
});

describe('repositoryRowKeyTarget', () => {
  const rows = repositoryListRows([art, game, tools], workspacesByRepository([{ workspace: gameWk, repository: game.spec }]), new Set([game.spec]));
  // 0 art, 1 game, 2 game-wk, 3 + game, 4 tools

  it('moves between repositories and workspaces, stepping over "New workspace"', () => {
    expect(repositoryRowKeyTarget(rows, 1, 'ArrowDown')).toBe(2);
    expect(repositoryRowKeyTarget(rows, 2, 'ArrowDown')).toBe(4);
    expect(repositoryRowKeyTarget(rows, 4, 'ArrowUp')).toBe(2);
    expect(repositoryRowKeyTarget(rows, 4, 'ArrowDown')).toBe(4);
  });

  it('goes to the first and last rows with Home and End, and a page at a time', () => {
    expect(repositoryRowKeyTarget(rows, 2, 'Home')).toBe(0);
    expect(repositoryRowKeyTarget(rows, 0, 'End')).toBe(4);
    expect(repositoryRowKeyTarget(rows, 0, 'PageDown')).toBe(4);
  });

  it('leaves the list with ↑ on its first row', () => {
    expect(repositoryRowKeyTarget(rows, 0, 'ArrowUp')).toBe('leaveTop');
  });

  it('does nothing from "New workspace" or for other keys', () => {
    expect(repositoryRowKeyTarget(rows, 3, 'ArrowDown')).toBeNull();
    expect(repositoryRowKeyTarget(rows, 1, 'a')).toBeNull();
  });
});

describe('repositoryRowIndex', () => {
  const workspaces = workspacesByRepository([{ workspace: gameWk, repository: game.spec }]);

  it('finds a row by its key as the rows above it come and go', () => {
    const collapsed = repositoryListRows([art, game, tools], workspaces, new Set());
    const toolsKey = repositoryRowKey(collapsed[2]!);
    const expanded = repositoryListRows([art, game, tools], workspaces, new Set([game.spec]));

    expect(repositoryRowIndex(collapsed, toolsKey)).toBe(2);
    expect(repositoryRowIndex(expanded, toolsKey)).toBe(4);
    expect(repositoryRowIndex(repositoryListRows([tools], workspaces, new Set()), toolsKey)).toBe(0);
  });

  it("tells a workspace's row from its repository's, and a row filtered out", () => {
    const expanded = repositoryListRows([game], workspaces, new Set([game.spec]));
    expect(expanded.map(repositoryRowKey)).toEqual(['repository:game@local', 'workspace:game@local:game-wk', 'newWorkspace:game@local']);
    expect(repositoryRowIndex(repositoryListRows([art], workspaces, new Set()), 'repository:game@local')).toBe(-1);
  });
});

describe('movesBetweenRows', () => {
  const press = { defaultPrevented: false, onRowButton: true, withModifiers: false };

  it("moves on a key pressed on a row's own button", () => {
    expect(movesBetweenRows(press)).toBe(true);
  });

  it("leaves ↓ on a row's ⋯ trigger to its menu, which opens on it", () => {
    expect(movesBetweenRows({ ...press, onRowButton: false, defaultPrevented: true })).toBe(false);
    expect(movesBetweenRows({ ...press, onRowButton: false })).toBe(false);
  });

  it('leaves a key something already handled, or a shortcut, alone', () => {
    expect(movesBetweenRows({ ...press, defaultPrevented: true })).toBe(false);
    expect(movesBetweenRows({ ...press, withModifiers: true })).toBe(false);
  });
});
