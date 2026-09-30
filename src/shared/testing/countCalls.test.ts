import { describe, expect, it } from 'vitest';
import { countCalls } from './countCalls';

class Differ {
  equals(left: string, right: string): boolean {
    return left === right;
  }
}

describe('countCalls', () => {
  it('counts the calls made during the run, then leaves the method as it was', () => {
    const differ = new Differ();

    const { result, calls } = countCalls(differ, 'equals', () => ['a', 'b', 'a'].filter((line) => differ.equals(line, 'a')));

    expect(result).toEqual(['a', 'a']);
    expect(calls).toBe(3);
    expect(Object.hasOwn(differ, 'equals')).toBe(false);
  });
});
