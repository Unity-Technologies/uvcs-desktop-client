import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { loadConflict } from './loadedConflict';

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
