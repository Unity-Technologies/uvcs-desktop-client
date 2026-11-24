import type { QueryClient } from '@tanstack/react-query';
import { onPendingSettlesChange, pendingSettleCount } from '../lib/settleTimeout';

/**
 * Marks the page while the window reads or changes anything through its query client, or waits for a selection to
 * settle before it reads (`settleTimeout`): `<html data-reading="true">`, `"false"` once nothing is in flight. The smoke
 * test waits for it before it ends a step, so each command it counts belongs to the step that sent it
 * (scripts/e2e/README.md, "Duplicate server commands"); it says nothing on screen. Written only when it changes: every
 * cache event calls it.
 */
export function markReadsInFlight(client: QueryClient, root: { dataset: DOMStringMap } = document.documentElement): () => void {
  const update = (): void => {
    const reading = String(client.isFetching() + client.isMutating() + pendingSettleCount() > 0);
    if (root.dataset.reading !== reading) root.dataset.reading = reading;
  };
  update();
  const stops = [client.getQueryCache().subscribe(update), client.getMutationCache().subscribe(update), onPendingSettlesChange(update)];
  return () => stops.forEach((stop) => stop());
}
