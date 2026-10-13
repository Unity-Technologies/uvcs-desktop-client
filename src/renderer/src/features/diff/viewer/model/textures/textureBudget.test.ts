import { describe, expect, it } from 'vitest';
import { fittedSize, sizeProblem, textureSideFor } from './textureBudget';

describe('the texture budget', () => {
  it('draws each texture at most 2048 px on its longest side, 1024 for a model with more than 24', () => {
    expect(textureSideFor(1)).toBe(2048);
    expect(textureSideFor(24)).toBe(2048);
    expect(textureSideFor(25)).toBe(1024);
  });

  it('shrinks a texture to the side keeping its proportions, and never grows one', () => {
    expect(fittedSize({ width: 8192, height: 4096 }, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(fittedSize({ width: 300, height: 9000 }, 1024)).toEqual({ width: 34, height: 1024 });
    expect(fittedSize({ width: 512, height: 256 }, 2048)).toEqual({ width: 512, height: 256 });
    expect(fittedSize({ width: 20000, height: 1 }, 1024)).toEqual({ width: 1024, height: 1 });
  });

  it('refuses before decoding an image past 16384 px on a side or 8192² pixels', () => {
    expect(sizeProblem({ width: 16384, height: 4096 })).toBeNull();
    expect(sizeProblem({ width: 16385, height: 16 })).toBe('tooLarge');
    expect(sizeProblem({ width: 16384, height: 16384 })).toBe('tooLarge');
  });
});
