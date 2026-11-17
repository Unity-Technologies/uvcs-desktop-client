import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from '@shared/domain/reviewConversation';
import { statusCommentMenu } from './statusCommentMenu';

const reviewed: ReviewEvent = { id: 7, author: 'ana', date: '', kind: 'statusChanged', status: 'Reviewed', comment: 'LGTM', guid: 's7' };
const ids = (entries: ReturnType<typeof statusCommentMenu>) => entries.map((entry) => (typeof entry === 'object' && 'id' in entry ? entry.id : 'separator'));

describe('statusCommentMenu', () => {
  it('offers the reviewer to edit what they said with their status, and never to delete it: the status stays', () => {
    expect(ids(statusCommentMenu(reviewed, 'ana', { edit: () => {} }))).toEqual(['editComment']);
  });

  it('offers nothing to anyone else, so no menu shows', () => {
    expect(statusCommentMenu(reviewed, 'bob', { edit: () => {} })).toEqual([]);
  });
});
