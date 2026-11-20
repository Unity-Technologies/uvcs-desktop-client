import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { openChangeRequest } from './openChangeRequest';

const PLACE = workspacePlace('/wk/game');
const AT_THREAD = { kind: 'codeReview', reviewId: 31415956, tab: 'conversation', focusThread: 31420112 };

describe('openChangeRequest', () => {
  it('opens a request the window read at its thread, asking nothing', async () => {
    await openChangeRequest(PLACE, { kind: 'thread', reviewId: 31415956, threadId: 31420112 });

    expect(whereTheWindowIs().pages).toEqual([AT_THREAD]);
    expect(fakeApi.calls()).toEqual([]);
  });

  it('finds a request the window has not read, then opens its review at its thread', async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => ({ reviewId: 31415956, threadId: 31420112 }));

    await openChangeRequest(PLACE, { kind: 'find', guid: 'abaa4cd8' });

    expect(fakeApi.argsOf('reviewComments.changeRequestThread')).toEqual([[PLACE, 'abaa4cd8']]);
    expect(whereTheWindowIs().pages).toEqual([AT_THREAD]);
  });

  it("says so when no request has that number, and opens nothing", async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => null);

    await openChangeRequest(PLACE, { kind: 'find', guid: 'abaa4cd8' });

    expect(whereTheWindowIs().pages).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Change request abaa4cd8 not found', detail: "It was deleted, or it's in a code review you can't see." }]);
  });

  it('says what failed when it could not be looked up', async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => {
      throw commandFailure('Connection refused');
    });

    await openChangeRequest(PLACE, { kind: 'find', guid: 'abaa4cd8' });

    expect(whereTheWindowIs().pages).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't open change request abaa4cd8", detail: 'Connection refused' }]);
  });
});
