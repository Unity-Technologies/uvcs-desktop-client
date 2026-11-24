import type { QueryClient } from '@tanstack/react-query';

/**
 * Marks the page while the window reads or changes anything through its query client (`<html data-reading="true">`),
 * `"false"` once nothing is in flight. The smoke test waits for it before it ends a step, so each command it counts
 * belongs to the step that sent it (scripts/e2e/README.md, "Duplicate server commands"); it says nothing on screen.
 */
export function markReadsInFlight(client: QueryClient, root: { dataset: DOMStringMap } = document.documentElement): () => void {
  const update = (): void => {
    root.dataset.reading = String(client.isFetching() + client.isMutating() > 0);
  };
  update();
  const stopQueries = client.getQueryCache().subscribe(update);
  const stopMutations = client.getMutationCache().subscribe(update);
  return () => {
    stopQueries();
    stopMutations();
  };
}
