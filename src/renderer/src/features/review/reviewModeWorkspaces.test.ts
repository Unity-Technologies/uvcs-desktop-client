import { describe, expect, it } from 'vitest';
import { withReviewMode } from './reviewModeWorkspaces';

describe('withReviewMode', () => {
  it('turns review mode on for one workspace, once', () => {
    expect(withReviewMode(['/a'], '/b', true)).toEqual(['/a', '/b']);
    expect(withReviewMode(['/a', '/b'], '/b', true)).toEqual(['/a', '/b']);
  });

  it('turns it off for that workspace only', () => {
    expect(withReviewMode(['/a', '/b'], '/a', false)).toEqual(['/b']);
    expect(withReviewMode([], '/a', false)).toEqual([]);
  });
});
