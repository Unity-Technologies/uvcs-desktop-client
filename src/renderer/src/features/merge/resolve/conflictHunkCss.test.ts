import { describe, expect, it } from 'vitest';
import { conflictHunkCss, shortenBranch } from './conflictHunkCss';

describe('shortenBranch', () => {
  it('keeps short branches whole', () => {
    expect(shortenBranch('/main/task')).toBe('/main/task');
  });

  it('drops whole folders from the middle of long ones, keeping the name', () => {
    expect(shortenBranch('/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test')).toBe('/main/…/child_1/subtask/merge-test');
  });

  it('cuts a long parent in its middle rather than dropping it', () => {
    expect(shortenBranch('/main/child-br-cr-sample-with-a-long-name/merge-test')).toBe('/main/child-br-cr-…-long-name/merge-test');
  });
});

describe('conflictHunkCss', () => {
  it('labels the source side and hides the markers', () => {
    const css = conflictHunkCss('Incoming', '/main/task');
    expect(css).toContain('content:"Incoming"');
    expect(css).toContain('content:"/main/task"');
    expect(css).toContain('[data-merge-conflict=marker-start]');
  });

  it('escapes what would end the CSS string', () => {
    expect(conflictHunkCss('Incoming', '/main/a"b')).toContain('content:"/main/a\\"b"');
  });
});
