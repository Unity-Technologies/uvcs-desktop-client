import { describe, expect, it } from 'vitest';
import cube from '@phosphor-icons/core/bold/cube-bold.svg?raw';
import buildings from '@phosphor-icons/core/bold/buildings-bold.svg?raw';
import { svgPathOf } from './svgPath';

describe('svgPathOf', () => {
  it('takes the shape of a one-path icon', () => {
    expect(svgPathOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M0,0H256V256Z"/></svg>')).toBe('M0,0H256V256Z');
  });

  it('reads the icons the app draws from their package, as it ships them', () => {
    expect(svgPathOf(cube)).toMatch(/^M225\.6,62\.64/);
    expect(svgPathOf(buildings)).toMatch(/^M240,204H228V96/);
  });

  it('fails on an icon of several paths, or none, rather than draw a part of it', () => {
    expect(() => svgPathOf('<svg><path d="M0,0"/><path d="M1,1"/></svg>')).toThrow('found 2');
    expect(() => svgPathOf('<svg><circle r="4"/></svg>')).toThrow('found 0');
  });
});
