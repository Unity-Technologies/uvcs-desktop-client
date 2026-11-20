import { describe, expect, it } from 'vitest';
import { changeRequestGuidCondition, changeRequestThreadOf, FOUND_CHANGE_REQUEST_THREADS } from './changeRequestThreads';
import { recordsIn, recordsOutput } from './testing/cmOutput';

describe('changeRequestGuidCondition', () => {
  it('finds a request named by the first eight digits of its guid as the guids starting with them', () => {
    expect(changeRequestGuidCondition('c0d1ce00')).toBe("guid like 'c0d1ce00%'");
  });

  it('finds a request named by its whole guid as that guid, in lower case', () => {
    expect(changeRequestGuidCondition('C0D1CE00-B457-4424-99FF-A3F1C0FA2582')).toBe("guid = 'c0d1ce00-b457-4424-99ff-a3f1c0fa2582'");
  });

  it('finds nothing for what no comment can name a request by, so nothing reaches the query unchecked', () => {
    expect(changeRequestGuidCondition('C0D1CE00')).toBeUndefined();
    expect(changeRequestGuidCondition('c0d1ce0')).toBeUndefined();
    expect(changeRequestGuidCondition("c0d1ce00' or 1=1")).toBeUndefined();
    expect(changeRequestGuidCondition('')).toBeUndefined();
  });
});

describe('changeRequestThreadOf', () => {
  const read = (...records: Partial<Record<(typeof FOUND_CHANGE_REQUEST_THREADS.fields)[number], string | number>>[]) =>
    recordsIn(recordsOutput(FOUND_CHANGE_REQUEST_THREADS, ...records), FOUND_CHANGE_REQUEST_THREADS);

  it("reads the request's review and its thread, as cm prints them", () => {
    expect(changeRequestThreadOf(read({ id: 51, reviewid: 43, type: 'change' }))).toEqual({ reviewId: 43, threadId: 51 });
  });

  it('keeps the change request among other comments whose guid starts the same', () => {
    expect(changeRequestThreadOf(read({ id: 7, reviewid: 3, type: 'question' }, { id: 9, reviewid: 4, type: 'change' }))).toEqual({ reviewId: 4, threadId: 9 });
  });

  it('finds none when no change request has that guid', () => {
    expect(changeRequestThreadOf(read())).toBeNull();
    expect(changeRequestThreadOf(read({ id: 7, reviewid: 3, type: 'conversation' }))).toBeNull();
  });
});
