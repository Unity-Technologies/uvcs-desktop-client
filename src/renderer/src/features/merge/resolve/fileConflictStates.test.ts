import { describe, expect, it, vi } from 'vitest';
import type { FileContent } from '@shared/domain/content';
import { buildStates, type BuiltStates, type ConflictFileInputs } from './fileConflictStates';
import * as threeWayMerge from './threeWayMerge';
import type { ConflictedFile } from './useFileConflicts';

vi.mock('./threeWayMerge', async (importOriginal) => {
  const original = await importOriginal<typeof import('./threeWayMerge')>();
  return { ...original, buildConflictDocument: vi.fn(original.buildConflictDocument) };
});

const labels = { source: '/main/task', destination: '/main' };
const text = (value: string): FileContent => ({ text: value, isBinary: false, size: value.length });
const fileOf = (index: number): ConflictedFile => ({
  key: `/f${index}.ts`,
  path: `f${index}.ts`,
  base: { kind: 'empty' },
  source: { kind: 'empty' },
  destination: { kind: 'empty' },
});

/** Files whose versions have loaded up to `loadedCount` (in the order they're asked for: each file's three in turn). */
function inputsOf(files: ConflictedFile[], versions: FileContent[][], loadedCount: number): ConflictFileInputs[] {
  return files.map((file, index) => ({
    file,
    versions: versions[index]!.map((data, side) => ({ data: index * 3 + side < loadedCount ? data : undefined, error: null })),
    decision: undefined,
    openTool: undefined,
  }));
}

describe('buildStates', () => {
  const files = Array.from({ length: 300 }, (_, index) => fileOf(index));
  const versions = files.map((_, index) => [text('a\nb\nc\n'), text(`a\nS${index}\nc\n`), text(`a\nD${index}\nc\n`)]);

  it('merges each file once, however many versions load one by one after it', () => {
    const merge = vi.mocked(threeWayMerge.buildConflictDocument);
    merge.mockClear();
    let built: BuiltStates = new Map();
    for (let loaded = 0; loaded <= files.length * 3; loaded++) built = buildStates(inputsOf(files, versions, loaded), labels, built).built;
    expect(merge).toHaveBeenCalledTimes(files.length);
  });

  it("keeps the states of files nothing changed about, and builds the one the user decided again", () => {
    const first = buildStates(inputsOf(files, versions, files.length * 3), labels, new Map());
    const decided = inputsOf(files, versions, files.length * 3);
    decided[1] = { ...decided[1]!, decision: { kind: 'wholeFile', side: 'source' } };
    const second = buildStates(decided, labels, first.built);
    expect(second.states[0]).toBe(first.states[0]);
    expect(second.states[1]).not.toBe(first.states[1]);
    expect(second.states[1]).toMatchObject({ decidedByUser: true, resolution: { choice: 'source' } });
  });

  it('reads a file as loading until its three versions are there, then as needing a decision', () => {
    const [file] = files;
    const { states } = buildStates(inputsOf([file!], versions, 2), labels, new Map());
    expect(states[0]).toMatchObject({ status: 'loading', resolution: null });
    expect(buildStates(inputsOf([file!], versions, 3), labels, new Map()).states[0]).toMatchObject({ status: 'ready', remainingConflicts: 1, resolution: null });
  });
});
