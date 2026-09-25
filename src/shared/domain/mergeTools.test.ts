import { describe, expect, it } from 'vitest';
import { canMergeIn, formatArgs, parseArgs, type MergeTool } from './mergeTools';

describe('parseArgs', () => {
  it('splits on spaces and keeps quoted parts in one argument', () => {
    expect(parseArgs(`merge  "{yours}" '{incoming}' -title="Yours ({yoursName})" ""`)).toEqual(['merge', '{yours}', '{incoming}', '-title=Yours ({yoursName})', '']);
  });

  it('reads back what formatArgs writes', () => {
    const args = ['-b={base}', 'with space', 'say "hi"', ''];
    expect(parseArgs(formatArgs(args))).toEqual(args);
  });
});

describe('canMergeIn', () => {
  const tool: MergeTool = {
    id: 'clientConf:0',
    name: 'UnityYAMLMerge',
    origin: 'clientConf',
    executable: '/opt/UnityYAMLMerge',
    args: [],
    defaultArgs: [],
    mergesBinaries: false,
    extensions: ['.unity'],
    canBringToFront: false,
  };

  it('offers client.conf tools by extension, case-insensitively, and every file to the others', () => {
    expect(canMergeIn(tool, 'Assets/Main.UNITY', false)).toBe(true);
    expect(canMergeIn(tool, 'Assets/Main.cs', false)).toBe(false);
    expect(canMergeIn({ ...tool, extensions: null }, 'Assets/Main.cs', false)).toBe(true);
  });

  it('offers binaries only to tools that merge them', () => {
    expect(canMergeIn({ ...tool, extensions: null }, 'a.png', true)).toBe(false);
    expect(canMergeIn({ ...tool, extensions: null, mergesBinaries: true }, 'a.png', true)).toBe(true);
  });
});
