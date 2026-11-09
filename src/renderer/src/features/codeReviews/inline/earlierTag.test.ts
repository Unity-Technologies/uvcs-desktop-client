import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { earlierTagOf } from './earlierTag';
import type { LineThread } from './fileThreads';

function thread(fields: Partial<ReviewComment> = {}): LineThread {
  const anchor = { kind: 'line', revisionId: 20, itemId: 7, path: '/a.cs', line: 3 } as const;
  return threadsOf([{ id: 1, guid: 'g', author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor, ...fields }])[0] as LineThread;
}

describe('earlierTagOf', () => {
  it('tells a thread still at its line from an outdated one', () => {
    expect(earlierTagOf(thread(), false)).toEqual({ label: 'Earlier version', tip: "Written on an earlier version of this file: this line hasn't changed since" });
    expect(earlierTagOf(thread(), true)).toEqual({ label: 'Outdated', tip: 'Written on an earlier version of this file: its line changed since' });
  });

  it('names the changeset a thread was written in, changeset by changeset', () => {
    expect(earlierTagOf(thread({ changesetId: 8 }), true).tip).toBe('Written on the file as changeset 8 left it: its line changed since');
  });
});
