import { QueryObserver, type QueryClient, type QueryKey, type QueryObserverOptions } from '@tanstack/react-query';

/** A query a test watches: how many times it was read, and whether a view shows it. */
export interface QueryProbe {
  /** How many times its query function ran. */
  readonly reads: () => number;
  /** Takes it off screen, as when its view unmounts. */
  hide: () => void;
}

type ProbeOptions = Omit<QueryObserverOptions, 'queryKey' | 'queryFn'> & {
  /** What each read answers; by default the number of the read. */
  answer?: (read: number) => unknown;
};

/** A query on screen (observed, as a mounted view's `useQuery`), read once as it shows. */
export async function showQuery(client: QueryClient, queryKey: QueryKey, { answer = (read) => read, ...options }: ProbeOptions = {}): Promise<QueryProbe> {
  let reads = 0;
  const observer = new QueryObserver(client, {
    queryKey,
    queryFn: async () => answer(++reads),
    ...options,
  });
  const unsubscribe = observer.subscribe(() => {});
  await client.fetchQuery({ queryKey, queryFn: async () => answer(++reads), ...(options as object) }).catch(() => undefined);
  return { reads: () => reads, hide: unsubscribe };
}

/** A query read once and then left in the cache, as a view no longer on screen leaves it. */
export async function readQuery(client: QueryClient, queryKey: QueryKey, options: ProbeOptions = {}): Promise<QueryProbe> {
  const probe = await showQuery(client, queryKey, options);
  probe.hide();
  return probe;
}
