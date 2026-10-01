import { describe, expect, it } from 'vitest';
import { labelCommentArgs } from './labelCommentArgs';

const label = { name: 'BL042', changeset: 1203, repository: 'acme@acme@cloud' };

describe('labelCommentArgs', () => {
  it('applies the label again to its own changeset with the new comment, both specs in its repository', () => {
    expect(labelCommentArgs(label, 'Release 42\n\nNotes', '/tmp/c.txt')).toEqual([
      'label',
      'create',
      'lb:BL042@acme@acme@cloud',
      'cs:1203@acme@acme@cloud',
      '-commentsfile=/tmp/c.txt',
    ]);
  });

  it('refuses an empty comment, which cm would ignore', () => {
    expect(() => labelCommentArgs(label, '  \n', '/tmp/c.txt')).toThrow(/can't remove/);
  });
});
