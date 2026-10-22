import { describe, expect, it } from 'vitest';
import type { MergeTool } from '@shared/domain/mergeTools';
import { hasOwnArgsToGoBackTo, mergeToolArgsProblem } from './mergeToolArgs';

const tool = (origin: MergeTool['origin'], args: string[]): MergeTool => ({ id: 't', name: 't', origin, executable: 't', args, defaultArgs: ['{base}', '{result}'], canBringToFront: false });

describe('mergeToolArgsProblem', () => {
  it('asks for {result}, alone or within an argument', () => {
    expect(mergeToolArgsProblem(['{base}', '{yours}'])).toBe('Include {result}: the file the tool saves the merge to.');
    expect(mergeToolArgsProblem(['--out={result}'])).toBeUndefined();
  });
});

describe('hasOwnArgsToGoBackTo', () => {
  it('is a known tool whose arguments the user changed; the user’s own tools have no others', () => {
    expect(hasOwnArgsToGoBackTo(tool('known', ['{result}']))).toBe(true);
    expect(hasOwnArgsToGoBackTo(tool('known', ['{base}', '{result}']))).toBe(false);
    expect(hasOwnArgsToGoBackTo(tool('custom', ['{result}']))).toBe(false);
  });
});
