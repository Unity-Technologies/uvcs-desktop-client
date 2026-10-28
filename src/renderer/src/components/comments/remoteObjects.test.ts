import '../../testing/fakeWindow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { focusManager, QueryClient, QueryObserver } from '@tanstack/react-query';
import { findReferences } from '../../lib/comments/commentReferences';
import {
  MAX_RESOLVED_PER_COMMENT,
  referencesOfBlocks,
  referencesToResolve,
  remoteObjectOf,
  remoteObjectQuery,
  serverReads,
  UNREADABLE_RETRY_MS,
  type RemoteObject,
  type RemoteRead,
} from './remoteObjects';

const PLACE = 'game@acme@unity';
const referencesIn = (text: string) => findReferences(text).map((found) => found.reference);
const remoteOf = (text: string) => remoteObjectOf(findReferences(text)[0]!.reference, PLACE);

describe('remoteObjectOf', () => {
  it('names a changeset or a label of another repository, and whether it is on the place’s server', () => {
    expect(remoteOf('cs:4@lib@acme@unity')).toEqual({ repository: 'lib@acme@unity', server: 'acme@unity', onPlaceServer: true, kind: 'changeset', id: 4 });
    expect(remoteOf('lb:v1.0@art')).toEqual({ repository: 'art@acme@unity', server: 'acme@unity', onPlaceServer: true, kind: 'label', name: 'v1.0' });
    expect(remoteOf('cs:4@art@acme@cloud')).toEqual({ repository: 'art@acme@cloud', server: 'acme@cloud', onPlaceServer: false, kind: 'changeset', id: 4 });
    expect(remoteOf('uvcs://acme.cloud/repos/art/changesets/1201')).toEqual({ repository: 'art@acme@cloud', server: 'acme@cloud', onPlaceServer: false, kind: 'changeset', id: 1201 });
  });

  it('tells the place’s server however it’s written: an organization in any case, a protocol or none', () => {
    expect(remoteObjectOf(findReferences('cs:4@lib@ACME@unity')[0]!.reference, PLACE)?.onPlaceServer).toBe(true);
    expect(remoteObjectOf(findReferences('cs:4@lib@ssl://host:8088')[0]!.reference, 'game@host:8088')?.onPlaceServer).toBe(true);
  });

  it('reads nothing for an object of the place’s own repository, however it’s written: the place’s caches hold it', () => {
    expect(remoteOf('cs:4')).toBeNull();
    expect(remoteOf('cs:4@game')).toBeNull();
    expect(remoteOf('cs:4@game@acme@unity')).toBeNull();
  });

  it('reads nothing it can’t read in one command, nor while the place’s repository is unknown', () => {
    expect(remoteOf('br:/main@art@acme@cloud')).toBeNull();
    expect(remoteOf('sh:3@art@acme@cloud')).toBeNull();
    expect(remoteOf('cr:9@art@acme@cloud')).toBeNull();
    expect(remoteObjectOf(findReferences('cs:4@art@acme@cloud')[0]!.reference, undefined)).toBeNull();
  });

  it('reads nothing a command line couldn’t quote safely: a quote in a repository, a server or a label', () => {
    expect(remoteOf("cs:4@a'b@srv:8087")).toBeNull();
    expect(remoteOf("lb:v'1@art")).toBeNull();
    expect(remoteOf('cs:4@a"b@srv:8087')).toBeNull();
  });
});

describe('referencesToResolve', () => {
  it('takes the objects on the place’s server once each, in the order they show, up to the cap', () => {
    const text = Array.from({ length: 12 }, (_, index) => `cs:${index + 1}@lib@acme@unity`).join(' ');
    const objects = referencesToResolve(referencesIn(`cs:1@lib@acme@unity cs:7 ${text}`), PLACE);
    expect(objects).toHaveLength(MAX_RESOLVED_PER_COMMENT);
    expect(objects.map((object) => object.kind === 'changeset' && object.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('never reads another server’s objects as a comment shows: only as a chip’s card opens', () => {
    expect(referencesToResolve(referencesIn('cs:4@art@acme@cloud cs:7@x@evil.example.com:8087 cs:2@lib'), PLACE)).toEqual([
      { repository: 'lib@acme@unity', server: 'acme@unity', onPlaceServer: true, kind: 'changeset', id: 2 },
    ]);
  });
});

describe('referencesOfBlocks', () => {
  it('finds the references of a comment read as Markdown, in order, in lists and quotes too', () => {
    const changeset = { kind: 'changeset', id: 4 };
    const label = { kind: 'label', name: 'v1' };
    const blocks = [
      { kind: 'paragraph', children: [{ kind: 'text', text: 'See ' }, { kind: 'reference', reference: changeset, source: 'cs:4' }] },
      { kind: 'list', items: [{ blocks: [{ kind: 'quote', blocks: [{ kind: 'paragraph', children: [{ kind: 'reference', reference: label, source: 'lb:v1' }] }] }] }] },
    ];
    expect(referencesOfBlocks(blocks)).toEqual([changeset, label]);
  });
});

describe('remoteObjectQuery', () => {
  const object: RemoteObject = { repository: 'art@acme@cloud', server: 'acme@cloud', onPlaceServer: false, kind: 'changeset', id: 4 };
  const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keys an object by its repository, apart from the place’s own caches', () => {
    expect(remoteObjectQuery(object).queryKey).not.toEqual(remoteObjectQuery({ ...object, repository: 'lib@acme@unity' }).queryKey);
    expect(JSON.stringify(remoteObjectQuery(object).queryKey)).toContain('art@acme@cloud');
  });

  it('reads an object once for good, and keeps an answer that there is none just the same', async () => {
    const queries = client();
    const read = vi.fn<(object: RemoteObject) => Promise<RemoteRead>>(async (asked) => (asked.kind === 'changeset' && asked.id === 4 ? { found: { comment: 'Fix' } } : { missing: true }));
    const missing: RemoteObject = { ...object, id: 1201 };
    for (let shown = 0; shown < 2; shown++) {
      await queries.prefetchQuery(remoteObjectQuery(object, read));
      await queries.prefetchQuery(remoteObjectQuery(missing, read));
      vi.advanceTimersByTime(60 * 60_000);
    }
    expect(read).toHaveBeenCalledTimes(2);
    expect(queries.getQueryData(remoteObjectQuery(missing).queryKey)).toEqual({ missing: true });
  });

  it('keeps an object read past TanStack’s five minutes off screen', async () => {
    const queries = client();
    await queries.prefetchQuery(remoteObjectQuery(object, async () => ({ found: { comment: 'Fix' } })));
    vi.advanceTimersByTime(60 * 60_000);
    expect(queries.getQueryData(remoteObjectQuery(object).queryKey)).toEqual({ found: { comment: 'Fix' } });
  });

  it('asks again after a failure only once `UNREADABLE_RETRY_MS` passed, so a server back online recovers', async () => {
    const queries = client();
    const failing = vi.fn<(object: RemoteObject) => Promise<RemoteRead>>(async () => {
      throw new Error('No access');
    });
    await queries.prefetchQuery(remoteObjectQuery(object, failing));
    expect(queries.getQueryData(remoteObjectQuery(object).queryKey)).toEqual({ unreadable: true });
    vi.advanceTimersByTime(UNREADABLE_RETRY_MS - 1);
    await queries.prefetchQuery(remoteObjectQuery(object, failing));
    expect(failing).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await queries.prefetchQuery(remoteObjectQuery(object, failing));
    expect(failing).toHaveBeenCalledTimes(2);
  });
});

describe('serverReads', () => {
  const object = (server: string, onPlaceServer = false): RemoteObject => ({ repository: `art@${server}`, server, onPlaceServer, kind: 'changeset', id: 4 });

  it('reads the place’s own server as a comment shows', () => {
    expect(serverReads(object('acme@unity', true), [])).toBe('onShow');
  });

  it('reads another server the user already works with only as the chip’s card opens', () => {
    expect(serverReads(object('build.acme.com:8087'), ['build.acme.com:8087', 'local'])).toBe('onCard');
    expect(serverReads(object('ssl://build.acme.com:8087'), ['build.acme.com:8087'])).toBe('onCard');
    expect(serverReads(object('ACME@cloud'), ['acme@cloud'])).toBe('onCard');
  });

  it('takes every organization of Unity Cloud for known once the user signs in to it for all of them', () => {
    expect(serverReads(object('other@cloud'), ['*@cloud'])).toBe('onCard');
    expect(serverReads(object('other@cloud'), ['acme@cloud'])).toBe('never');
  });

  it('never reads a server the user doesn’t work with: cm would sign in there with the user’s own credentials', () => {
    expect(serverReads(object('attacker.example.com:8087'), ['build.acme.com:8087'])).toBe('never');
  });

  it('waits for the user’s servers before deciding', () => {
    expect(serverReads(object('build.acme.com:8087'), undefined)).toBe('unknownYet');
  });
});

describe('remoteObjectQuery, as the window comes back', () => {
  it('reads nothing again on focus or a reconnection, even once a failure is stale', async () => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const object: RemoteObject = { repository: 'art@build.acme.com:8087', server: 'build.acme.com:8087', onPlaceServer: false, kind: 'changeset', id: 4 };
    const failing = vi.fn<(object: RemoteObject) => Promise<RemoteRead>>(async () => {
      throw new Error('No access');
    });
    const observer = new QueryObserver(client, remoteObjectQuery(object, failing));
    const unsubscribe = observer.subscribe(() => {});
    try {
      await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(1));
      vi.advanceTimersByTime(UNREADABLE_RETRY_MS + 1);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      await Promise.resolve();
      expect(failing).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
      focusManager.setFocused(undefined);
      vi.useRealTimers();
    }
  });
});
