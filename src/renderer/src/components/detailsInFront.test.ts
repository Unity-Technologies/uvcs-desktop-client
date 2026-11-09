import { describe, expect, it } from 'vitest';
import { detailsKeyInFront } from './detailsInFront';

const toggle = (detailsKey: string, seen: boolean) => ({ detailsKey, element: { seen } });
const seen = (element: { seen: boolean }) => element.seen;

describe('detailsKeyInFront', () => {
  it('is the view in front, not the one hidden under a page', () => {
    expect(detailsKeyInFront([toggle('branches', false), toggle('browseRepositoryTree', true)], seen)).toBe('browseRepositoryTree');
    expect(detailsKeyInFront([toggle('browseRepositoryTree', true), toggle('branches', false)], seen)).toBe('browseRepositoryTree');
  });

  it('is none when the page in front has no details, so the view under it keeps its own', () => {
    expect(detailsKeyInFront([toggle('branches', false)], seen)).toBeUndefined();
    expect(detailsKeyInFront([], seen)).toBeUndefined();
  });

  it('is the last one mounted when two are seen', () => {
    expect(detailsKeyInFront([toggle('labels', true), toggle('branches', true)], seen)).toBe('branches');
  });
});
