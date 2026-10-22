import { describe, expect, it } from 'vitest';
import { PrintedWorkspacePaths } from './printedWorkspacePaths';

describe('PrintedWorkspacePaths', () => {
  it('reads paths under a root cm keeps resolved through a link, as macOS resolves /tmp to /private/tmp', () => {
    const paths = new PrintedWorkspacePaths('/tmp/game', 'darwin', (path) => (path === '/tmp/game' ? '/private/tmp/game' : path));

    expect(paths.relative('/private/tmp/game/src/a.txt')).toBe('src/a.txt');
    expect(paths.relative('/private/tmp/game/b.txt')).toBe('b.txt');
  });

  it('fails on a path neither the root nor the root resolved holds', () => {
    const paths = new PrintedWorkspacePaths('/tmp/game', 'linux', () => '/private/tmp/game');
    expect(() => paths.relative('/elsewhere/a.txt')).toThrow('cm printed a path outside the workspace /tmp/game: /elsewhere/a.txt');
  });
});
