import { commandFailure, fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { shownToasts, whereTheWindowIs } from '../../testing/operationOutcome';
import { openChangeRequest } from './openChangeRequest';

const PLACE = workspacePlace('/wk/game');
const AT_THREAD = { kind: 'codeReview', reviewId: 43, tab: 'conversation', focusThread: 51 };

describe('openChangeRequest', () => {
  it('opens a request the window read at its thread, asking nothing', async () => {
    await openChangeRequest(PLACE, { kind: 'thread', reviewId: 43, threadId: 51 });

    expect(whereTheWindowIs().pages).toEqual([AT_THREAD]);
    expect(fakeApi.calls()).toEqual([]);
  });

  it('finds a request the window has not read, then opens its review at its thread', async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => ({ reviewId: 43, threadId: 51 }));

    await openChangeRequest(PLACE, { kind: 'find', guid: 'c0d1ce00' });

    expect(fakeApi.argsOf('reviewComments.changeRequestThread')).toEqual([[PLACE, 'c0d1ce00']]);
    expect(whereTheWindowIs().pages).toEqual([AT_THREAD]);
  });

  it("says so when no request has that number, and opens nothing", async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => null);

    await openChangeRequest(PLACE, { kind: 'find', guid: 'c0d1ce00' });

    expect(whereTheWindowIs().pages).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'info', title: 'Change request c0d1ce00 not found', detail: "It was deleted, or it's in a code review you can't see." }]);
  });

  it('names one its whole guid names by its number, as its chip does', async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => null);

    await openChangeRequest(PLACE, { kind: 'find', guid: 'C0D1CE00-B457-4424-99FF-A3F1C0FA2582' });

    expect(shownToasts().map((shown) => shown.title)).toEqual(['Change request c0d1ce00 not found']);
  });

  it('asks once while a click is still finding the same request', async () => {
    let answer: (thread: unknown) => void = () => {};
    fakeApi.answer('reviewComments.changeRequestThread', () => new Promise((resolve) => (answer = resolve)));

    const first = openChangeRequest(PLACE, { kind: 'find', guid: 'c0d1ce00' });
    await openChangeRequest(PLACE, { kind: 'find', guid: 'c0d1ce00' });
    answer({ reviewId: 43, threadId: 51 });
    await first;

    expect(fakeApi.methods()).toEqual(['reviewComments.changeRequestThread']);
    expect(whereTheWindowIs().pages).toEqual([AT_THREAD]);
  });

  it('says what failed when it could not be looked up', async () => {
    fakeApi.answer('reviewComments.changeRequestThread', () => {
      throw commandFailure('Connection refused');
    });

    await openChangeRequest(PLACE, { kind: 'find', guid: 'c0d1ce00' });

    expect(whereTheWindowIs().pages).toEqual([]);
    expect(shownToasts()).toEqual([{ kind: 'error', title: "Couldn't open change request c0d1ce00", detail: 'Connection refused' }]);
  });
});
