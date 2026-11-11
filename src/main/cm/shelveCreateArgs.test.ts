import { describe, expect, it } from 'vitest';
import { shelveCreateArgs } from './shelveCreateArgs';

describe('shelveCreateArgs', () => {
  it('shelves every change of a standard workspace, moved and deleted ones included', () => {
    expect(shelveCreateArgs([], '/tmp/comment.txt', 'standard')).toEqual(['shelveset', 'create', '--all', '-commentsfile=/tmp/comment.txt']);
  });

  // `--dependencies`: the added folders above a path, as a check-in takes them (`checkinArgs`).
  it('shelves some paths of a standard workspace with the added folders above them', () => {
    expect(shelveCreateArgs(['/wk/a.cs'], '/tmp/comment.txt', 'dynamic')).toEqual([
      'shelveset',
      'create',
      '/wk/a.cs',
      '--all',
      '--dependencies',
      '-commentsfile=/tmp/comment.txt',
    ]);
  });

  // `cm shelveset create` refuses a partial workspace. `cm partial shelveset create` has no `--all` or `--dependencies`:
  // it takes every change under the paths given, and `--applychanged` adds the files changed but not checked out.
  it('shelves a partial workspace with cm partial shelveset create', () => {
    expect(shelveCreateArgs([], '/tmp/comment.txt', 'partial')).toEqual(['partial', 'shelveset', 'create', '--applychanged', '-commentsfile=/tmp/comment.txt']);
  });

  it('shelves some paths of a partial workspace', () => {
    expect(shelveCreateArgs(['/wk/a.cs'], '/tmp/comment.txt', 'partial')).toEqual([
      'partial',
      'shelveset',
      'create',
      '/wk/a.cs',
      '--applychanged',
      '-commentsfile=/tmp/comment.txt',
    ]);
  });
});
