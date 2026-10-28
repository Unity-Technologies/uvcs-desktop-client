import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { findReferences } from '../../lib/comments/commentReferences';
import { MAX_RESOLVED_PER_COMMENT, referencesOfBlocks, referencesToResolve, remoteObjectOf, remoteObjectQuery, type RemoteObject, type RemoteRead } from './remoteObjects';

const PLACE = 'game@acme@unity';
const referencesIn = (text: string) => findReferences(text).map((found) => found.reference);
const remoteOf = (text: string) => remoteObjectOf(findReferences(text)[0]!.reference, PLACE);

describe('remoteObjectOf', () => {
  it('names a changeset or a label of another repository, on the place’s server when the spec names none', () => {
    expect(remoteOf('cs:4@codice@codice@cloud')).toEqual({ repository: 'codice@codice@cloud', kind: 'changeset', id: 4 });
    expect(remoteOf('lb:v1.0@art')).toEqual({ repository: 'art@acme@unity', kind: 'label', name: 'v1.0' });
    expect(remoteOf('uvcs://codice.cloud/repos/codice/changesets/280528')).toEqual({ repository: 'codice@codice@cloud', kind: 'changeset', id: 280528 });
  });

  it('reads nothing for an object of the place’s own repository, however it’s written: the place’s caches hold it', () => {
    expect(remoteOf('cs:4')).toBeNull();
    expect(remoteOf('cs:4@game')).toBeNull();
    expect(remoteOf('cs:4@game@acme@unity')).toBeNull();
  });

  it('reads nothing it can’t read in one command, nor while the place’s repository is unknown', () => {
    expect(remoteOf('br:/main@codice@codice@cloud')).toBeNull();
    expect(remoteOf('sh:3@codice@codice@cloud')).toBeNull();
    expect(remoteOf('cr:9@codice@codice@cloud')).toBeNull();
    expect(remoteObjectOf(findReferences('cs:4@codice@codice@cloud')[0]!.reference, undefined)).toBeNull();
  });
});

describe('referencesToResolve', () => {
  it('takes the other repositories’ objects once each, in the order they show, up to the cap', () => {
    const text = Array.from({ length: 12 }, (_, index) => `cs:${index + 1}@codice@codice@cloud`).join(' ');
    const objects = referencesToResolve(referencesIn(`cs:1@codice@codice@cloud cs:7 ${text}`), PLACE);
    expect(objects).toHaveLength(MAX_RESOLVED_PER_COMMENT);
    expect(objects.map((object) => object.kind === 'changeset' && object.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
  const object: RemoteObject = { repository: 'codice@codice@cloud', kind: 'changeset', id: 4 };

  it('keys an object by its repository, apart from the place’s own caches', () => {
    expect(remoteObjectQuery(object).queryKey).toEqual([...remoteObjectQuery({ ...object }).queryKey]);
    expect(remoteObjectQuery(object).queryKey).not.toEqual(remoteObjectQuery({ ...object, repository: 'lib@acme@unity' }).queryKey);
    expect(JSON.stringify(remoteObjectQuery(object).queryKey)).toContain('codice@codice@cloud');
  });

  it('reads each object once for the session, a failure too, so showing it again asks nothing', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const read = vi.fn<(object: RemoteObject) => Promise<RemoteRead>>(async () => ({ found: { comment: 'Fix the switch' } }));
    const failing = vi.fn<(object: RemoteObject) => Promise<RemoteRead>>(async () => {
      throw new Error('No access');
    });
    const twelve = referencesToResolve(referencesIn(Array.from({ length: 12 }, (_, index) => `cs:${index + 1}@codice@codice@cloud`).join(' ')), PLACE);

    for (const shown of twelve) await client.prefetchQuery(remoteObjectQuery(shown, read));
    for (const shown of twelve) await client.prefetchQuery(remoteObjectQuery(shown, read));
    expect(read).toHaveBeenCalledTimes(10);

    const unreachable: RemoteObject = { repository: 'gone@far', kind: 'label', name: 'v1' };
    await client.prefetchQuery(remoteObjectQuery(unreachable, failing));
    await client.prefetchQuery(remoteObjectQuery(unreachable, failing));
    expect(failing).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(remoteObjectQuery(unreachable).queryKey)).toEqual({ unreadable: true });
  });

  it('waits for a chip’s card to open, in a row', () => {
    expect(remoteObjectQuery(object, undefined, false).enabled).toBe(false);
    expect(remoteObjectQuery(object, undefined, true).enabled).toBe(true);
  });
});
