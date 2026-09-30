import '../../testing/fakeWindow';
import { focusManager, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '../../app/queryClient';
import { showQuery } from '../../testing/queryProbes';
import { reviewSummariesQuery } from './useCodeReviews';

let client: QueryClient;
beforeEach(() => {
  client = createQueryClient();
  client.mount();
  vi.useFakeTimers({ toFake: ['Date'] });
});
afterEach(() => {
  client.unmount();
  client.clear();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

/** The user comes back to the window; resolves once the client has handled it. */
async function focus(): Promise<void> {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the newest code reviews (branch chips, the palette)', () => {
  it('are a list read rarely: coming back to the window never reads them again, however old', async () => {
    const { queryKey, queryFn: _read, ...options } = reviewSummariesQuery('/ws');
    const reviews = await showQuery(client, queryKey, options);

    vi.advanceTimersByTime(60 * 60_000);
    await focus();

    expect(reviews.reads()).toBe(1);
  });
});
