import { describe, expect, it } from 'vitest';
import { resizedSize } from './resizeHandleSize';

describe('resizedSize', () => {
  it('grows a pane under its top edge as the splitter goes up', () => {
    expect(resizedSize('top', { startSize: 300, startY: 500, y: 450 }, 100, 800)).toBe(350);
    expect(resizedSize('top', { startSize: 300, startY: 500, y: 550 }, 100, 800)).toBe(250);
  });

  it('grows a list over its bottom edge as the splitter goes down', () => {
    expect(resizedSize('bottom', { startSize: 200, startY: 400, y: 460 }, 64, 500)).toBe(260);
    expect(resizedSize('bottom', { startSize: 200, startY: 400, y: 340 }, 64, 500)).toBe(140);
  });

  it('stops at the shortest and the tallest the element can be', () => {
    expect(resizedSize('bottom', { startSize: 200, startY: 400, y: 0 }, 64, 500)).toBe(64);
    expect(resizedSize('bottom', { startSize: 200, startY: 400, y: 2000 }, 64, 500)).toBe(500);
  });
});
