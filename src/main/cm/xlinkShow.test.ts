import { describe, expect, it } from 'vitest';
import { parseXlinkRules } from './xlinkShow';

/** `cm xlink --show` of a writable xlink, as `cm` prints it on Windows. */
const WRITABLE = [
  'c:\\wk\\game\\code\\lib --> wxlink:lib:/@2@lib@local',
  'Branch expansion rules:',
  'br:/main/task 1@game@local -> br:/main/x@lib@local [user-defined]',
  'br:/main/my-fix@game@local -> br:/main/fix-1@lib@local',
  '',
].join('\r\n');

describe('The branch expansion rules of an xlink', () => {
  it('reads each rule, and whether someone added it or cm did as it created the branch', () => {
    expect(parseXlinkRules(WRITABLE)).toEqual([
      { from: '/main/task 1', to: '/main/x', userDefined: true },
      { from: '/main/my-fix', to: '/main/fix-1', userDefined: false },
    ]);
  });

  it('reads repositories of Unity Cloud, whose server holds an @', () => {
    const cloud = 'br:/main@game@acme@cloud -> br:/main/dev@lib@acme@cloud [user-defined]';

    expect(parseXlinkRules(cloud)).toEqual([{ from: '/main', to: '/main/dev', userDefined: true }]);
  });

  it('reads none for a read-only xlink or one without rules: cm prints only its own line', () => {
    expect(parseXlinkRules('/wk/game/code/ro --> xlink:ro:/sub@1@lib@local\n')).toEqual([]);
  });
});
