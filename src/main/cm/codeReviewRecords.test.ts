import { describe, expect, it } from 'vitest';
import { FOUND_REVIEWS, mergeRequestOf } from './codeReviewRecords';
import { recordsIn, recordsOutput } from './testing/cmOutput';

/** The fields of a review `cm find review` prints, with the merge request's two as a sandbox printed them. */
function found(id: number, title: string, mergerequeststatus: string, destination: string) {
  return { id, title, codereviewstatus: 'Under review', mergerequeststatus, destination, targettype: 'Branch', target: 'id:20', reviewers: '', comments: 0, unresolvedissues: 0 };
}

describe('merge requests in cm find review', () => {
  it('reads a merge request’s state and destination, and none for a plain review', () => {
    const output = recordsOutput(
      FOUND_REVIEWS,
      found(40, 'Task one', 'Open', 'br:/main'),
      found(42, 'Task two, draft', 'Draft', 'br:/main'),
      found(45, 'Task four', 'Open', 'br:/main/release'),
      found(46, 'Plain review', 'None', ''),
    );

    expect(recordsIn(output, FOUND_REVIEWS).map(({ id, mergeRequest }) => ({ id, mergeRequest }))).toEqual([
      { id: 40, mergeRequest: { state: 'Open', destination: '/main' } },
      { id: 42, mergeRequest: { state: 'Draft', destination: '/main' } },
      { id: 45, mergeRequest: { state: 'Open', destination: '/main/release' } },
      { id: 46, mergeRequest: undefined },
    ]);
  });

  it('reads every state, whatever its case', () => {
    expect(['Draft', 'Open', 'Merged', 'Closed', 'merged'].map((state) => mergeRequestOf(state, 'br:/main')?.state)).toEqual(['Draft', 'Open', 'Merged', 'Closed', 'Merged']);
  });

  it('reads a plain review where the state is None, unknown, or the destination is missing', () => {
    expect([mergeRequestOf('None', ''), mergeRequestOf('None', 'br:/main'), mergeRequestOf('Queued', 'br:/main'), mergeRequestOf('Open', ''), mergeRequestOf('', '')]).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps a destination’s spaces and non-ASCII letters, without the br: prefix', () => {
    expect(mergeRequestOf('Open', 'br:/main/release 2.0/tâche-日本')?.destination).toBe('/main/release 2.0/tâche-日本');
    expect(mergeRequestOf('Open', '/main')?.destination).toBe('/main');
  });

  it('reads records whose lines end with CRLF', () => {
    const output = recordsOutput(FOUND_REVIEWS, found(43, 'Task three', 'Merged', 'br:/main')).replace(/\n/g, '\r\n');

    expect(recordsIn(output, FOUND_REVIEWS)[0]?.mergeRequest).toEqual({ state: 'Merged', destination: '/main' });
  });
});
