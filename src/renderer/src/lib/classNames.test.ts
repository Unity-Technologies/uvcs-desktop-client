import { describe, expect, it } from 'vitest';
import { classNames } from './classNames';

describe('classNames', () => {
  it('joins the classes that apply, dropping conditions that failed and props left out', () => {
    expect(classNames('cell', false, 'end', undefined, null, '')).toBe('cell end');
  });

  it('is empty when no class applies', () => {
    expect(classNames(false, undefined)).toBe('');
  });
});
