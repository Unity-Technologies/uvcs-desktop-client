import { describe, expect, it } from 'vitest';
import { rankPaths } from './rankPaths';

const paths = ['src/core/mod1.ts', 'src/ui/widgets/Button.tsx', 'docs/readme.md', 'README.md', 'src/readme-helper.ts'];

describe('rankPaths', () => {
  it('keeps only fuzzy matches', () => {
    expect(rankPaths(paths, 'btn', 10)).toEqual(['src/ui/widgets/Button.tsx']);
  });

  it('prefers file-name matches and shorter paths', () => {
    expect(rankPaths(paths, 'readme', 10)).toEqual(['README.md', 'docs/readme.md', 'src/readme-helper.ts']);
  });

  it('returns the first paths when the query is empty', () => {
    expect(rankPaths(paths, '  ', 2)).toEqual(['src/core/mod1.ts', 'src/ui/widgets/Button.tsx']);
  });
});
