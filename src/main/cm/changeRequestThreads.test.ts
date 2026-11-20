import { describe, expect, it } from 'vitest';
import { changeRequestGuidCondition, changeRequestThreadOf, FOUND_CHANGE_REQUEST_THREADS } from './changeRequestThreads';
import { recordsIn, recordsOutput } from './testing/cmOutput';

describe('changeRequestGuidCondition', () => {
  it('finds a request named by the first eight digits of its guid as the guids starting with them', () => {
    expect(changeRequestGuidCondition('abaa4cd8')).toBe("guid like 'abaa4cd8%'");
  });

  it('finds a request named by its whole guid as that guid, in lower case', () => {
    expect(changeRequestGuidCondition('ABAA4CD8-F4A4-4447-8570-A9B9278E4A6C')).toBe("guid = 'abaa4cd8-f4a4-4447-8570-a9b9278e4a6c'");
  });

  it('finds nothing for what no comment can name a request by, so nothing reaches the query unchecked', () => {
    expect(changeRequestGuidCondition('ABAA4CD8')).toBeUndefined();
    expect(changeRequestGuidCondition('abaa4cd')).toBeUndefined();
    expect(changeRequestGuidCondition("abaa4cd8' or 1=1")).toBeUndefined();
    expect(changeRequestGuidCondition('')).toBeUndefined();
  });
});

describe('changeRequestThreadOf', () => {
  const read = (...records: Partial<Record<(typeof FOUND_CHANGE_REQUEST_THREADS.fields)[number], string | number>>[]) =>
    recordsIn(recordsOutput(FOUND_CHANGE_REQUEST_THREADS, ...records), FOUND_CHANGE_REQUEST_THREADS);

  it("reads the request's review and its thread, as cm prints them", () => {
    expect(changeRequestThreadOf(read({ id: 31420112, reviewid: 31415956, type: 'change' }))).toEqual({ reviewId: 31415956, threadId: 31420112 });
  });

  it('keeps the change request among other comments whose guid starts the same', () => {
    expect(changeRequestThreadOf(read({ id: 7, reviewid: 3, type: 'question' }, { id: 9, reviewid: 4, type: 'change' }))).toEqual({ reviewId: 4, threadId: 9 });
  });

  it('finds none when no change request has that guid', () => {
    expect(changeRequestThreadOf(read())).toBeNull();
    expect(changeRequestThreadOf(read({ id: 7, reviewid: 3, type: 'conversation' }))).toBeNull();
  });
});
