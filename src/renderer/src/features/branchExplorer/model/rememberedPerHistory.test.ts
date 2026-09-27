import { describe, expect, it } from 'vitest';
import { rememberedPerHistory } from './rememberedPerHistory';

describe('rememberedPerHistory', () => {
  it('computes again only when an input or the history changes', () => {
    const history = {};
    let runs = 0;
    const compute = (): number => ++runs;
    expect(rememberedPerHistory(history, 'layout', ['a', 1], compute)).toBe(1);
    expect(rememberedPerHistory(history, 'layout', ['a', 1], compute)).toBe(1);
    expect(rememberedPerHistory(history, 'layout', ['a', 2], compute)).toBe(2);
    expect(rememberedPerHistory({}, 'layout', ['a', 2], compute)).toBe(3);
  });

  it('keeps each purpose apart', () => {
    const history = {};
    expect(rememberedPerHistory(history, 'authors', [], () => 'authors')).toBe('authors');
    expect(rememberedPerHistory(history, 'branches', [], () => 'branches')).toBe('branches');
    expect(rememberedPerHistory(history, 'authors', [], () => 'again')).toBe('authors');
  });
});
