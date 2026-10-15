import { describe, expect, it } from 'vitest';
import type { ContentSource, FileContent } from '@shared/domain/content';
import { readsOnOpen, upFrontReads, versionsOf, type VersionRead } from './conflictVersionReads';
import type { ConflictedFile } from './useFileConflicts';

const at = (path: string, side: string): ContentSource => ({ kind: 'spec', spec: `${side}:${path}`, fileName: path });
const fileOf = (path: string, isKnownBinary = false): ConflictedFile => ({
  key: `/${path}`,
  path,
  base: at(path, 'base'),
  source: at(path, 'source'),
  destination: at(path, 'destination'),
  ...(isKnownBinary && { isKnownBinary }),
});
const read = (text: string): VersionRead => ({ data: { text, isBinary: false, size: text.length } satisfies FileContent, error: null });

const code = fileOf('src/Player.cs');
const textures = Array.from({ length: 200 }, (_, index) => fileOf(`Assets/Textures/T${index}.png`, true));
const files = [textures[0]!, code, ...textures.slice(1)];

describe('upFrontReads', () => {
  it("reads no version of a merge's known binaries as the page opens, however many: only the others' three each", () => {
    expect(upFrontReads(files).sources).toEqual([code.base, code.source, code.destination]);
    expect(upFrontReads(textures).sources).toEqual([]);
  });
});

describe('readsOnOpen', () => {
  it("reads a known binary's three versions once the user opens it, and nothing more for a file read up front", () => {
    expect(readsOnOpen(textures[7])).toEqual([textures[7]!.base, textures[7]!.source, textures[7]!.destination]);
    expect(readsOnOpen(code)).toEqual([]);
    expect(readsOnOpen(undefined)).toEqual([]);
  });
});

describe('versionsOf', () => {
  const upFront = upFrontReads(files);
  const results = [read('base'), read('source'), read('destination')];
  const opened = { key: textures[3]!.key, versions: [read('b'), read('s'), read('d')] };

  it("gives each file its own versions: read up front, as the binary opened read them, or none yet", () => {
    expect(versionsOf(code, upFront, results, opened)).toEqual(results);
    expect(versionsOf(textures[3]!, upFront, results, opened)).toBe(opened.versions);
    expect(versionsOf(textures[4]!, upFront, results, opened)).toEqual([{ error: null }, { error: null }, { error: null }]);
  });
});
