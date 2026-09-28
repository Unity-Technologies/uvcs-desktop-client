import { describe, expect, it } from 'vitest';
import { readCheckinOutput } from './checkinOutput';

describe('readCheckinOutput', () => {
  it('reads the changeset created, the checkouts without edits left out', () => {
    const output = [
      'CI_START',
      'STAGE Validating checkin data',
      'STAGE Uploading file data',
      'STAGE Confirming checkin operation',
      'STAGE ',
      'CO /private/tmp/wk/c.txt',
      "CHANGESET cs:2@br:/main/task001@repo@local (mount:'/')",
    ].join('\n');
    expect(readCheckinOutput(output)).toEqual({ kind: 'created', changesetId: 2, branch: '/main/task001' });
  });

  it('reads no changeset when only checkouts without edits went in: cm released them', () => {
    const output = ['CI_START', 'STAGE Validating checkin data', 'STAGE ', 'NO_CHANGES_APPLIED'].join('\n');
    expect(readCheckinOutput(output)).toEqual({ kind: 'noChanges' });
  });

  it('fails when cm reported neither', () => {
    expect(() => readCheckinOutput('CI_START\nSTAGE ')).toThrow('no changeset was reported');
  });

  it('takes no path or comment for the tag', () => {
    expect(() => readCheckinOutput('CO /wk/NO_CHANGES_APPLIED')).toThrow();
  });
});
