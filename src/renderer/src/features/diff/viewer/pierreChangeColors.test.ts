import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sameChangeColors } from './pierreChangeColors';

const light = {
  deleted: 'light-dark(#ffe8e4, #3a2124)',
  added: 'light-dark(#e7f4ec, #1b312e)',
  deletedWords: 'light-dark(rgb(from #cf222e r g b / .15), rgb(from #f85149 r g b / .2))',
  addedWords: 'light-dark(rgb(from #1a7f37 r g b / .15), rgb(from #3fb950 r g b / .2))',
  colorScheme: 'light',
};

describe('sameChangeColors', () => {
  it('keeps the marks as they are while the diff keeps its colors', () => {
    expect(sameChangeColors(light, { ...light })).toBe(true);
  });

  it("recolors the marks when the theme changes either tint, either changed words' color or the scheme", () => {
    expect(sameChangeColors(light, { ...light, deleted: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, added: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, deletedWords: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, addedWords: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, colorScheme: 'dark' })).toBe(false);
  });

  it('colors the marks the first time', () => {
    expect(sameChangeColors(undefined, light)).toBe(false);
  });
});

describe("Pierre's row tints and changed words' colors", () => {
  it('are on its host, where the change map reads them: an update that moves them fails here', () => {
    const style = readFileSync(join(__dirname, '../../../../../../node_modules/@pierre/diffs/dist/style.js'), 'utf8');
    expect(style).toMatch(/:host\{[^}]*--diffs-bg-deletion:/);
    expect(style).toMatch(/:host\{[^}]*--diffs-bg-addition:/);
    expect(style).toMatch(/:host\{[^}]*--diffs-bg-deletion-emphasis:/);
    expect(style).toMatch(/:host\{[^}]*--diffs-bg-addition-emphasis:/);
  });
});
