import { describe, expect, it } from 'vitest';
import { automaticShelveComment, parseCreatedShelves } from './automaticShelve';

describe('automaticShelveComment', () => {
  it("uses the official client's comment, so it finds and offers these shelves too", () => {
    expect(automaticShelveComment('br:29')).toBe('Automatic shelve created during switch operation (from br:29)');
    expect(automaticShelveComment('cs:12')).toBe('Automatic shelve created during switch operation (from cs:12)');
  });
});

describe('parseCreatedShelves', () => {
  it('reads every created shelve, one per repository with changes', () => {
    const output = [
      'Uploading file data',
      'Confirming checkin operation',
      'Modified /private/tmp/swx/w1',
      'Added /private/tmp/swx/w1/new.txt',
      "Created shelve sh:2@swx@local (mount:'/')",
      "Created shelve sh:7@lib@codice@cloud (mount:'/lib')",
    ].join('\n');
    expect(parseCreatedShelves(output)).toEqual([
      { id: 2, repository: 'swx@local' },
      { id: 7, repository: 'lib@codice@cloud' },
    ]);
  });

  it('finds nothing in other output', () => {
    expect(parseCreatedShelves('Added /tmp/sh:3.txt\n')).toEqual([]);
  });
});
