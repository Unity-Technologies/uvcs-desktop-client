import { describe, expect, it } from 'vitest';
import { findArgs } from './findQuery';

describe('findArgs', () => {
  it('combines filter conditions, order and limit', () => {
    expect(findArgs('changeset', { owner: 'me', sinceDate: '2026-01-01', limit: 50 }, 'changesetid desc')).toEqual([
      'find',
      'changeset',
      "where date >= '2026-01-01' and owner = 'me' order by changesetid desc limit 50",
      '--xml',
      '--nototal',
    ]);
  });

  it('escapes quotes in values', () => {
    expect(findArgs('branch', { owner: "o'neil" }, null)[2]).toBe("where owner = 'o''neil'");
  });
});
