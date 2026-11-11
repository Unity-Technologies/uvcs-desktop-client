import '../../../testing/fakeWindow';
import { QueryObserver } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import { queryKeys } from '../../../api/queryKeys';
import { createQueryClient } from '../../../app/queryClient';
import { conversationReadSince } from './useReviewConversation';

const PLACE = workspacePlace('/ws');
const KEY = queryKeys.inPlace(PLACE, 'codeReviews', 'conversation', 41);

/** A conversation on screen: its query in the cache, observed, read at `at`. */
function shownConversation(at: number) {
  const client = createQueryClient();
  client.setQueryData(KEY, 'read', { updatedAt: at });
  const observer = new QueryObserver(client, { queryKey: KEY, queryFn: () => 'read', enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  return { client, unsubscribe };
}

describe('conversationReadSince', () => {
  it('waits for the read the write asked for, reading nothing itself', async () => {
    const { client } = shownConversation(100);
    let done = false;
    const waiting = conversationReadSince(PLACE, 41, 200, client).then(() => (done = true));

    await Promise.resolve();
    expect(done).toBe(false);
    client.setQueryData(KEY, 'read again', { updatedAt: 300 });
    await waiting;
    expect(done).toBe(true);
  });

  it('resolves at once when nothing shows the conversation, as nothing reads it then', async () => {
    const { client, unsubscribe } = shownConversation(100);
    unsubscribe();
    await expect(conversationReadSince(PLACE, 41, 200, client)).resolves.toBeUndefined();
    await expect(conversationReadSince(PLACE, 99, 200, createQueryClient())).resolves.toBeUndefined();
  });

  it('resolves when the read fails too: the field then stops waiting', async () => {
    const { client } = shownConversation(100);
    const waiting = conversationReadSince(PLACE, 41, 200, client);
    const query = client.getQueryCache().find({ queryKey: KEY })!;
    query.setState({ ...query.state, errorUpdatedAt: 300, status: 'error' });
    await expect(waiting).resolves.toBeUndefined();
  });
});
