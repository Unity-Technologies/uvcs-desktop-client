import { describe, expect, it } from 'vitest';
import { caseTolerantPattern, findArgs } from './findQuery';

describe('findArgs', () => {
  it('combines filter conditions, order and limit', () => {
    expect(findArgs('changeset', { owners: ['me'], sinceDate: '2026-01-01', limit: 50 }, 'changesetid desc')).toEqual([
      'find',
      'changeset',
      "where date >= '2026-01-01' and owner = 'me' order by changesetid desc limit 50",
      '--xml',
      '--nototal',
    ]);
  });

  it('searches the text in the field that describes each object', () => {
    expect(findArgs('branch', { text: 'task' }, null)[2]).toBe("where name like '%ask%'");
    expect(findArgs('review', { text: 'fix', limit: 5 }, null)[2]).toBe("where title like '%ix%' limit 5");
  });

  // `cm find` reads no quote inside a value, neither doubled nor between double quotes ("Query error"), so a search
  // for "Everyone's shelves" used to fail. A quote matches any text instead; results are filtered precisely afterwards.
  it('searches text holding quotes with a wildcard in their place', () => {
    expect(findArgs('changeset', { text: "don't" }, null)[2]).toBe("where comment like '%on%t%'");
    expect(findArgs('branch', { text: "Everyone's shelves" }, null)[2]).toBe("where name like '%veryone%s%helves%'");
    expect(findArgs('review', { text: 'say "hi"' }, null)[2]).toBe("where title like '%ay%hi%%'");
  });

  it('ignores the case of the first letter of each word', () => {
    expect(caseTolerantPattern('bamboo  plugin')).toBe('%amboo%lugin%');
    expect(caseTolerantPattern('a fix')).toBe('%a%ix%');
  });

  it('asks for objects by any of several owners in one condition', () => {
    expect(findArgs('branch', { owners: ['me', 'ana@corp.com'], sinceDate: '2026-01-01' }, null)[2]).toBe(
      "where date >= '2026-01-01' and (owner = 'me' or owner = 'ana@corp.com')",
    );
    expect(findArgs('label', { owners: [] }, null)[2]).toBe('');
  });

  it('escapes quotes in values', () => {
    expect(findArgs('branch', { owners: ["o'neil"] }, null)[2]).toBe("where owner = 'o''neil'");
  });
});
