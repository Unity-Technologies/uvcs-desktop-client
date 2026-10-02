import { describe, expect, it } from 'vitest';
import { parseRecords } from '../formatRecords';
import { findRecords } from '../findObjects';
import { extendedAclOutput, findXml, formatOutput } from './cmOutput';

describe('synthetic cm output', () => {
  it("is what the app's parsers read", () => {
    expect(parseRecords(formatOutput(['1', 'a b'], ['2', 'ç']))).toEqual([
      ['1', 'a b'],
      ['2', 'ç'],
    ]);
    expect(findRecords(findXml('BRANCH', { ID: 3, NAME: '/main/a&b' }), 'BRANCH')).toEqual([{ ID: '3', NAME: '/main/a&b' }]);
  });

  it('indents cm showacl --extended as cm 11 does', () => {
    const printed = extendedAclOutput({
      creator: 'rep:perm-probe@repserver:daniel:8087',
      inherited: [{ creator: 'repserver:daniel:8087', entries: { 'ALL USERS': { Allowed: 'all' } } }],
    });

    // What cm 11.0.16 printed for a branch sharing its repository's list, but the ACL ids.
    expect(printed.replace(/ACL: \d+/g, 'ACL: 0')).toBe(
      [
        '  ACL: 0',
        '    Creator rep:perm-probe@repserver:daniel:8087',
        '    Inherited',
        '      ACL: 0',
        '        Creator repserver:daniel:8087',
        '        Entries',
        '         ALL USERS:',
        '           Allowed:',
        '            all',
        '',
      ].join('\n'),
    );
  });
});
