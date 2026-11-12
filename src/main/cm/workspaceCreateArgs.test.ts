import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceCreateArgs } from './workspaceCreateArgs';

const PATH = join('wkspaces', 'game ñ');

describe('workspaceCreateArgs', () => {
  it('creates a regular workspace in the repository', () => {
    expect(workspaceCreateArgs({ name: 'game', path: PATH, repository: 'game@cloud.example:8087' })).toEqual([
      'workspace',
      'create',
      'game',
      PATH,
      'game@cloud.example:8087',
    ]);
  });

  it('creates a dynamic workspace loading /main of the repository, which cm takes from --tree only', () => {
    expect(workspaceCreateArgs({ name: 'game', path: PATH, repository: 'game@cloud.example:8087', kind: 'dynamic' })).toEqual([
      'workspace',
      'create',
      'game',
      PATH,
      '--dynamic',
      '--tree=br:/main@game@cloud.example:8087',
    ]);
  });
});
