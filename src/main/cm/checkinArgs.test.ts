import { describe, expect, it } from 'vitest';
import { checkinArgs } from './checkinArgs';

describe('checkinArgs', () => {
  it('checks in links themselves, not the files they point to', () => {
    expect(checkinArgs(['/wk/link', '/wk/src/a.ts'], '/tmp/comment.txt')).toEqual([
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
});
