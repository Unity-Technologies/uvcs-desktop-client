import { describe, expect, it } from 'vitest';
import { conflictHunkCss, shortenBranch } from './conflictHunkCss';

describe('shortenBranch', () => {
  it('keeps short branches whole', () => {
    expect(shortenBranch('/main/task')).toBe('/main/task');
  });

  it('drops whole folders from the middle of long ones, keeping the name', () => {
    expect(shortenBranch('/main/child-br-cr-sample/empty-branch2/child_1/subtask/merge-test')).toBe('/main/…/child_1/subtask/merge-test');
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
