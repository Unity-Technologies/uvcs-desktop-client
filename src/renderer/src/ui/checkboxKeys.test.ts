import { describe, expect, it } from 'vitest';
import { submitsForm } from './checkboxKeys';

describe('submitsForm', () => {
  it('submits on Enter, like a native checkbox, instead of toggling', () => {
    expect(submitsForm('Enter')).toBe(true);
  });

  it('leaves Space and other keys to toggle or do nothing', () => {
    expect(submitsForm(' ')).toBe(false);
    expect(submitsForm('Tab')).toBe(false);
  });
});
