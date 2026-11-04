import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sameChangeColors } from './pierreChangeColors';

const light = { deleted: 'light-dark(#ffe8e4, #3a2124)', added: 'light-dark(#e7f4ec, #1b312e)', colorScheme: 'light' };

describe('sameChangeColors', () => {
  it('keeps the marks as they are while the diff keeps its colors', () => {
    expect(sameChangeColors(light, { ...light })).toBe(true);
  });

  it('recolors the marks when the theme changes either tint or the scheme', () => {
    expect(sameChangeColors(light, { ...light, deleted: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, added: 'light-dark(#fff, #000)' })).toBe(false);
    expect(sameChangeColors(light, { ...light, colorScheme: 'dark' })).toBe(false);
  });

  it('colors the marks the first time', () => {
    expect(sameChangeColors(undefined, light)).toBe(false);
  });
});

describe("Pierre's row tints", () => {
  it('are on its host, where the change map reads them: an update that moves them fails here', () => {
    const style = readFileSync(join(__dirname, '../../../../../../node_modules/@pierre/diffs/dist/style.js'), 'utf8');
    const host = style.slice(style.indexOf(':host{'));
    expect(host).toMatch(/--diffs-bg-deletion:/);
    expect(host).toMatch(/--diffs-bg-addition:/);
  });
});
