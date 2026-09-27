import { describe, expect, it } from 'vitest';
import { oncePerPress } from './backButtons';

describe('oncePerPress', () => {
  it('goes back once for a press that arrives twice, and again for the next press', () => {
    let clock = 1000;
    let backs = 0;
    const back = oncePerPress(() => backs++, () => clock);
    back();
    clock += 20;
    back();
    expect(backs).toBe(1);
    clock += 400;
    back();
    expect(backs).toBe(2);
  });
});
