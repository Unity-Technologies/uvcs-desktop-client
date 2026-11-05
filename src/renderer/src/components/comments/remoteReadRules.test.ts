/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';

const RENDERER = join(__dirname, '..', '..');

/**
 * A read of another repository's object goes through two doors only: a comment shown in full (`ResolvedReferences`,
 * capped, the place's server) and a chip with its card open (`useRemoteObject`, through `chipRead`). A chip that
 * enabled a read as it drew once ran a `cm find` per row of a list.
 */
describe('reads of other repositories’ objects', () => {
  it('start only where a comment shows in full or a chip’s card opens', () => {
    const readers = filesUnder(RENDERER, isAppSource)
      .filter((path) => !path.endsWith('.test.ts') && /\bremoteObjectQuery\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(RENDERER, path))
      .sort();
    expect(readers).toEqual([join('components', 'comments', 'ResolvedReferences.tsx'), join('components', 'comments', 'remoteObjects.ts'), join('components', 'comments', 'useRemoteObject.ts')].sort());
  });

  it('of issues, start only where a comment shows in full, an issue chip’s card opens, or a key typed after `#` settles', () => {
    const readers = filesUnder(RENDERER, isAppSource)
      .filter((path) => !path.endsWith('.test.ts') && /\bissueQuery\(/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(RENDERER, path))
      .sort();
    expect(readers).toEqual(
      [join('components', 'issues', 'IssueChip.tsx'), join('components', 'issues', 'ResolvedIssues.tsx'), join('components', 'issues', 'issueQueries.ts'), join('components', 'commentEditor', 'useIssueSuggestionRows.ts')].sort(),
    );
    // `reads.key` is set only once typing settles on a key (`issueSuggestionReads`).
    expect(readFileSync(join(RENDERER, 'components', 'commentEditor', 'useIssueSuggestionRows.ts'), 'utf8')).toMatch(/issueQuery\([^)]*\), enabled: asking && reads\.key !== null \}/);
    expect(readFileSync(join(RENDERER, 'components', 'issues', 'IssueChip.tsx'), 'utf8')).toMatch(/issueQuery\([^)]*\), enabled: cardOpen \}/);
    expect(readFileSync(join(RENDERER, 'components', 'issues', 'ResolvedIssues.tsx'), 'utf8')).toMatch(/enabled: settled/);
  });

  it('in a chip, are enabled by `chipRead` alone', () => {
    const hook = readFileSync(join(RENDERER, 'components', 'comments', 'useRemoteObject.ts'), 'utf8');
    expect(hook).toMatch(/remoteObjectQuery\(object, undefined, chipRead\(/);
  });
});
