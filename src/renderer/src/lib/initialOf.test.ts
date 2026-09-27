import { describe, expect, it } from 'vitest';
import { initialOf } from './initialOf';

describe('initialOf', () => {
  it("takes a workspace's first letter, capitalized", () => {
    expect(initialOf('wk')).toBe('W');
    expect(initialOf('2DMicroGame')).toBe('2');
  });

  it("skips a repository's organization", () => {
    expect(initialOf('unity/game')).toBe('G');
  });
});
