import { describe, expect, it } from 'vitest';
import { pingRings } from './searchPing';

describe('pingRings', () => {
  it('draws nothing before it starts or once it settles', () => {
    expect(pingRings(0)).toEqual([]);
    expect(pingRings(1)).toEqual([]);
    expect(pingRings(-0.2)).toEqual([]);
  });

  it('sends a second ring after the first', () => {
    expect(pingRings(0.2)).toHaveLength(1);
    expect(pingRings(0.6)).toHaveLength(2);
  });

  it('grows the rings while they fade', () => {
    const [early] = pingRings(0.1);
    const [late] = pingRings(0.3);
    expect(late!.grow).toBeGreaterThan(early!.grow);
    expect(late!.alpha).toBeLessThan(early!.alpha);
  });
});
