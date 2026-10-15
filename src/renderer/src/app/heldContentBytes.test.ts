import { describe, expect, it } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { heldContentBytes } from './heldContentBytes';

const queryOf = (area: string, data: unknown) => ({ queryKey: ['workspace', '/work', area, 'source'], state: { data } }) as never;

describe('heldContentBytes', () => {
  const model: FileContent = { model: { bytes: new Uint8Array(1000), format: 'glb' }, isBinary: true, size: 1000 };
  const text: FileContent = { text: 'v 0 0 0\n', model: { bytes: new Uint8Array(8), format: 'obj' }, isBinary: false, size: 8 };

  it("holds a version's content by its text, image and model, and a diff's pair as the same two objects", () => {
    expect(heldContentBytes(queryOf('content', model))).toEqual(new Map([[model, 1000]]));
    const pair = heldContentBytes(queryOf('diffContents', { original: {}, modified: {}, left: model, right: text }));
    expect([...pair]).toEqual([
      [model, 1000],
      [text, 16],
    ]);
  });

  it("holds a file's bytes, and nothing for other queries or before their data comes", () => {
    const bytes = new Uint8Array(64);
    expect(heldContentBytes(queryOf('contentBytes', bytes))).toEqual(new Map([[bytes, 64]]));
    expect(heldContentBytes(queryOf('contentBytes', null)).size).toBe(0);
    expect(heldContentBytes(queryOf('changesets', [model])).size).toBe(0);
    expect(heldContentBytes(queryOf('content', undefined)).size).toBe(0);
  });
});
