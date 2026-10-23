import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { loadConflict, UNMERGEABLE_PURGED_MESSAGE } from './loadedConflict';

const purged: FileContent = { isBinary: false, size: 0, purged: true };

const labels = { source: '/main/task', destination: '/main' };
const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const loaded = (...contents: FileContent[]) => contents.map((data) => ({ data, error: null }));

describe('loadConflict', () => {
  it('waits for the three versions', () => {
    expect(loadConflict([{ error: null }, ...loaded(text('a\n'), text('b\n'))], labels)).toEqual({ status: 'loading' });
  });

  it('fails when any version fails', () => {
    const error = new Error('gone');
    expect(loadConflict([...loaded(text('a\n'), text('b\n')), { error }], labels)).toEqual({ status: 'error', error });
  });

  it('fails when a version was purged, never merging it as an empty text', () => {
    expect(loadConflict(loaded(purged, text('b\n'), text('c\n')), labels)).toEqual({ status: 'error', error: new Error(UNMERGEABLE_PURGED_MESSAGE) });
  });

  it('merges the versions once they are all there', () => {
    const result = loadConflict(loaded(text('a\nb\nc\n'), text('a\nS\nc\n'), text('a\nD\nc\n')), labels);
    expect(result.status === 'ready' && result.document?.conflictCount).toBe(1);
  });

  it('keeps the merge of versions it merged already, so each file merges once however many others load after it', () => {
    const versions = loaded(text('a\nb\nc\n'), text('a\nS\nc\n'), text('a\nD\nc\n'));
    const first = loadConflict(versions, labels);
    expect(loadConflict([...versions], labels, first)).toBe(first);
  });

  it('merges again when a version or the labels change', () => {
    const versions = loaded(text('a\nb\nc\n'), text('a\nS\nc\n'), text('a\nD\nc\n'));
    const first = loadConflict(versions, labels);
    expect(loadConflict([versions[0]!, versions[1]!, { data: text('a\nD\nc\n'), error: null }], labels, first)).not.toBe(first);
    expect(loadConflict(versions, { ...labels }, first)).not.toBe(first);
  });

  it('leaves binaries unmerged', () => {
    const binary: FileContent = { isBinary: true, size: 3 };
    const result = loadConflict(loaded(binary, text('a'), text('b')), labels);
    expect(result.status === 'ready' && result.document).toBeUndefined();
  });
});

describe('loadConflict of a known binary', () => {
  const notRead = [{ error: null }, { error: null }, { error: null }];

  it('is ready for a decision before any version is read', () => {
    expect(loadConflict(notRead, labels, undefined, true)).toEqual({ status: 'ready', labels });
  });

  it('shows its versions once read, never merged, even when they read as text', () => {
    const versions = loaded(text('a\n'), text('b\n'), text('c\n'));
    const result = loadConflict(versions, labels, undefined, true);
    expect(result).toEqual({ status: 'ready', labels, contents: { base: versions[0]!.data, source: versions[1]!.data, destination: versions[2]!.data } });
    expect(loadConflict([...versions], labels, result, true)).toBe(result);
  });

  it("still waits for a decision when its versions can't be read, and says why", () => {
    const error = new Error('gone');
    expect(loadConflict([...loaded(text('a'), text('b')), { error }], labels, undefined, true)).toEqual({ status: 'ready', labels, error });
  });

  it('still waits for a decision when a version was purged, saying so, and keeps that state while it holds', () => {
    const versions = loaded(text('a'), purged, text('c'));
    const result = loadConflict(versions, labels, undefined, true);
    expect(result).toEqual({ status: 'ready', labels, error: new Error(UNMERGEABLE_PURGED_MESSAGE) });
    expect(loadConflict([...versions], labels, result, true)).toBe(result);
  });
});
