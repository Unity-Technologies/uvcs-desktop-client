import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ReviewMark } from '@shared/domain/review';
import { queryClient } from '../../../app/queryClient';
import { shownToasts } from '../../../testing/operationOutcome';
import { setReviewed } from './reviewOperations';
import { reviewMarksKey } from './useReviewMarks';

const ws = '/ws';
const marks = (): ReviewMark[] | undefined => queryClient.getQueryData(reviewMarksKey(ws));

describe('setReviewed', () => {
  it('shows the files reviewed at once, keeping the reviewed copies already taken, and stores the marks', async () => {
    queryClient.setQueryData<ReviewMark[]>(reviewMarksKey(ws), [
      { path: 'a.ts', state: 'changedSinceReview', hasSnapshot: true },
      { path: 'c.ts', state: 'reviewed', hasSnapshot: false },
    ]);
    fakeApi.answer('review.mark', () => undefined);

    await setReviewed(ws, ['a.ts', 'b.ts'], true);

    expect(marks()).toEqual([
      { path: 'c.ts', state: 'reviewed', hasSnapshot: false },
      { path: 'a.ts', state: 'reviewed', hasSnapshot: true },
      { path: 'b.ts', state: 'reviewed', hasSnapshot: false },
    ]);
    expect(fakeApi.argsOf('review.mark')).toEqual([[ws, ['a.ts', 'b.ts']]]);
  });

  it('clears the marks of the files at once', async () => {
    queryClient.setQueryData<ReviewMark[]>(reviewMarksKey(ws), [
      { path: 'a.ts', state: 'reviewed', hasSnapshot: true },
      { path: 'c.ts', state: 'reviewed', hasSnapshot: false },
    ]);
    fakeApi.answer('review.unmark', () => undefined);

    await setReviewed(ws, ['a.ts'], false);

    expect(marks()).toEqual([{ path: 'c.ts', state: 'reviewed', hasSnapshot: false }]);
    expect(fakeApi.argsOf('review.unmark')).toEqual([[ws, ['a.ts']]]);
  });

  it('says so when the marks could not be stored, and reads them again', async () => {
    queryClient.setQueryData<ReviewMark[]>(reviewMarksKey(ws), []);
    fakeApi.answer('review.mark', () => {
      throw new Error('read-only disk');
    });

    await setReviewed(ws, ['a.ts'], true);

    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't mark the files as reviewed", detail: 'read-only disk' }]);
    expect(queryClient.getQueryState(reviewMarksKey(ws))?.isInvalidated).toBe(true);
  });

  it('asks nothing for no files', async () => {
    await setReviewed(ws, [], true);

    expect(fakeApi.methods()).toEqual([]);
  });
});
