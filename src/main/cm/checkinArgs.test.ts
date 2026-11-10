import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';

describe('checkinArgs', () => {
  it('checks in links themselves, not the files they point to', () => {
    expect(checkinArgs(['/wk/link', '/wk/src/a.ts'], '/tmp/comment.txt', true, 'standard')).toEqual([
      'checkin',
      '/wk/link',
      '/wk/src/a.ts',
      '--all',
      '--dependencies',
      '--private',
      '-commentsfile=/tmp/comment.txt',
      '--machinereadable',
      '--symlink',
    ]);
  });

  // `--private` adds every private item under each path given, whether the user checked it or not. `--dependencies`
  // adds the private and added folders above a path, and nothing else in them.
  it('adds private items only when the user checked one', () => {
    expect(checkinArgs(['/wk/src/a.ts'], '/tmp/comment.txt', false, 'standard')).toEqual(['checkin', '/wk/src/a.ts', '--all', '--dependencies', '-commentsfile=/tmp/comment.txt', '--machinereadable', '--symlink']);
  });

  // cm partial checkin takes the same options as cm checkin (--all and --dependencies among them) and checks in only what
  // the partial workspace loads.
  it('checks in a partial workspace with cm partial checkin, the same items and options', () => {
    expect(checkinArgs(['/wk/src/a.ts'], '/tmp/comment.txt', false, 'partial')).toEqual([
      'partial',
      'checkin',
      '/wk/src/a.ts',
      '--all',
      '--dependencies',
      '-commentsfile=/tmp/comment.txt',
      '--machinereadable',
      '--symlink',
    ]);
  });

  it('checks in a dynamic workspace with cm checkin', () => {
    expect(checkinArgs(['/wk/src/a.ts'], '/tmp/comment.txt', false, 'dynamic')[0]).toBe('checkin');
  });
});
