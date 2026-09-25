import { describe, expect, it } from 'vitest';
import { DrawnBoxes } from './drawnBoxes';

describe('DrawnBoxes', () => {
  it('finds the box under a point, the last drawn on top', () => {
    const boxes = new DrawnBoxes<string>();
    boxes.add('below', 0, 0, 100, 20);
    boxes.add('above', 50, 0, 100, 20);
    expect(boxes.at({ x: 10, y: 10 })?.item).toBe('below');
    expect(boxes.at({ x: 60, y: 10 })?.item).toBe('above');
    expect(boxes.at({ x: 60, y: 30 })).toBeNull();
  });

  it('forgets the previous frame once reset, reusing its boxes', () => {
    const boxes = new DrawnBoxes<string>();
    boxes.add('old', 0, 0, 10, 10);
    boxes.reset();
    expect(boxes.at({ x: 5, y: 5 })).toBeNull();
    boxes.add('new', 20, 0, 10, 10);
    expect(boxes.at({ x: 25, y: 5 })?.item).toBe('new');
    expect(boxes.find((item) => item === 'old')).toBeNull();
    expect(boxes.find((item) => item === 'new')?.x).toBe(20);
  });

});
