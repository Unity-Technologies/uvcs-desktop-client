import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';

describe('checkinArgs', () => {
  it('checks in links themselves, not the files they point to', () => {
    expect(checkinArgs(['/wk/link', '/wk/src/a.ts'], '/tmp/comment.txt', true)).toEqual([
      'checkin',
      '/wk/link',
      '/wk/src/a.ts',
      '--all',
      '--private',
      '-commentsfile=/tmp/comment.txt',
      '--machinereadable',
      '--symlink',
    ]);
  });

  // `--private` adds every private item under each path given, whether the user checked it or not.
  it('adds private items only when the user checked one', () => {
    expect(checkinArgs(['/wk/src/a.ts'], '/tmp/comment.txt', false)).toEqual(['checkin', '/wk/src/a.ts', '--all', '-commentsfile=/tmp/comment.txt', '--machinereadable']);
  });
});
