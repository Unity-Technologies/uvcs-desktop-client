import { describe, expect, it } from 'vitest';
import { parseRecords } from '../formatRecords';
import { findRecords } from '../findObjects';
import { findXml, formatOutput } from './cmOutput';

describe('synthetic cm output', () => {
  it("is what the app's parsers read", () => {
    expect(parseRecords(formatOutput(['1', 'a b'], ['2', 'ç']))).toEqual([
      ['1', 'a b'],
      ['2', 'ç'],
    ]);
    expect(findRecords(findXml('BRANCH', { ID: 3, NAME: '/main/a&b' }), 'BRANCH')).toEqual([{ ID: '3', NAME: '/main/a&b' }]);
  });
});
