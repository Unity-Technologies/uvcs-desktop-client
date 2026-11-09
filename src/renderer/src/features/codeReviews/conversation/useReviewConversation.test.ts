import '../../../testing/fakeWindow';
import type { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../../app/queryClient';
import { showOnce, showQuery } from '../../../testing/queryProbes';
import { SHOWN_BY_THE_PAGE } from './useReviewConversation';

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  client.unmount();
  client.clear();
  vi.useRealTimers();
});

const CONVERSATION = ['place', 'codeReviews', 'conversation', 41];

describe('the conversation a dialog over the review shows (SHOWN_BY_THE_PAGE)', () => {
  it('is the one the page shows, however old: opening the dialog asks cm nothing', async () => {
    const page = await showQuery(client, CONVERSATION);
    vi.advanceTimersByTime(60_000);

    await showOnce(client, { queryKey: CONVERSATION, queryFn: async () => 'read again', ...SHOWN_BY_THE_PAGE });

    expect(page.reads()).toBe(1);
    expect(client.getQueryData(CONVERSATION)).toBe(1);
  });
});
