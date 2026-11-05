import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { isInScope, isSearching, offeredPrefixes, parseScope, SCOPE_PREFIXES } from './paletteScope';

describe('parseScope', () => {
  it('searches everything without a prefix', () => {
    expect(parseScope('  main ')).toEqual({ scope: 'all', text: 'main' });
  });

  it('narrows the search to the section a prefix names', () => {
    expect(parseScope('>switch')).toEqual({ scope: 'commands', text: 'switch' });
    expect(parseScope('/Player.cs')).toEqual({ scope: 'files', text: 'Player.cs' });
    expect(parseScope('br:/main/task')).toEqual({ scope: 'branches', text: '/main/task' });
    expect(parseScope('lb:v1.4')).toEqual({ scope: 'labels', text: 'v1.4' });
    expect(parseScope('cs:1234')).toEqual({ scope: 'changesets', text: '1234' });
    expect(parseScope('sh:12')).toEqual({ scope: 'shelves', text: '12' });
    expect(parseScope('cr:login')).toEqual({ scope: 'codeReviews', text: 'login' });
    expect(parseScope('@ana')).toEqual({ scope: 'people', text: 'ana' });
  });

  it('takes the space after a prefix, and before it', () => {
    expect(parseScope('  br: main ')).toEqual({ scope: 'branches', text: 'main' });
  });

  it('lists the whole section for a bare prefix', () => {
    expect(parseScope('cs:')).toEqual({ scope: 'changesets', text: '' });
    expect(parseScope('@')).toEqual({ scope: 'people', text: '' });
    expect(parseScope('cr: ')).toEqual({ scope: 'codeReviews', text: '' });
  });

  it('reads a prefix only at the start, as typed: later in the text, or in capitals, it is text', () => {
    expect(parseScope('fix br:main')).toEqual({ scope: 'all', text: 'fix br:main' });
    expect(parseScope('ana@acme.com')).toEqual({ scope: 'all', text: 'ana@acme.com' });
    expect(parseScope('CS:12')).toEqual({ scope: 'all', text: 'CS:12' });
    expect(parseScope('cs12')).toEqual({ scope: 'all', text: 'cs12' });
  });

  it('keeps `#` for issues: a changeset is found by its number in an "all" search', () => {
    expect(parseScope('#1234')).toEqual({ scope: 'all', text: '#1234' });
    expect(parseScope('1234')).toEqual({ scope: 'all', text: '1234' });
  });
});

describe('SCOPE_PREFIXES', () => {
  it('has one prefix per section, the palette\'s own first, and none for the workspaces', () => {
    expect(SCOPE_PREFIXES.map(({ prefix, scope }) => [prefix, scope])).toEqual([
      ['>', 'commands'],
      ['/', 'files'],
      ['cs:', 'changesets'],
      ['br:', 'branches'],
      ['lb:', 'labels'],
      ['sh:', 'shelves'],
      ['cr:', 'codeReviews'],
      ['@', 'people'],
    ]);
  });

  it('names each section in the footer\'s words', () => {
    expect(SCOPE_PREFIXES.map(({ hint }) => hint)).toEqual(['commands', 'files', 'changesets', 'branches', 'labels', 'shelves', 'code reviews', 'people']);
  });
});

describe('offeredPrefixes', () => {
  const prefixes = (shown: Parameters<typeof offeredPrefixes>[0]) => offeredPrefixes(shown).map(({ prefix }) => prefix);

  it('offers only commands on the home screen, every prefix but files in a repository, and all of them in a workspace', () => {
    expect(prefixes(null)).toEqual(['>']);
    expect(prefixes(repositoryPlace('game@local'))).toEqual(['>', 'cs:', 'br:', 'lb:', 'sh:', 'cr:', '@']);
    expect(prefixes(workspacePlace('/ws'))).toEqual(['>', '/', 'cs:', 'br:', 'lb:', 'sh:', 'cr:', '@']);
  });
});

describe('isInScope', () => {
  it('takes every section in an "all" search, else only the one the prefix names', () => {
    expect(isInScope('files', 'all')).toBe(true);
    expect(isInScope('labels', 'labels')).toBe(true);
    expect(isInScope('branches', 'labels')).toBe(false);
    expect(isInScope('workspaces', 'people')).toBe(false);
  });
});

describe('isSearching', () => {
  const loads = [
    { section: 'commands' as const, waiting: false },
    { section: 'branches' as const, waiting: true },
    { section: 'files' as const, waiting: false },
  ];

  it('waits for any section still loading or searching', () => {
    expect(isSearching(loads, 'all')).toBe(true);
    expect(isSearching(loads, 'branches')).toBe(true);
  });

  it('answers at once when only sections out of scope wait, so `>` never says "Searching…"', () => {
    expect(isSearching(loads, 'commands')).toBe(false);
    expect(isSearching(loads, 'files')).toBe(false);
  });
});
