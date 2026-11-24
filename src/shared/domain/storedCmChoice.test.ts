import { describe, expect, it } from 'vitest';
import { storedCmChoice } from './storedCmChoice';

describe('storedCmChoice', () => {
  it('moves settings saved before the automatic choice to it, once, whatever they held', () => {
    expect(storedCmChoice({ cmChoice: 'managed' })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'installed' })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({})).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
  });

  it('keeps the app’s own when it was chosen since', () => {
    expect(storedCmChoice({ cmChoice: 'managed', cmDeclinedUpdateFor: null })).toEqual({ cmChoice: 'managed', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'automatic', cmDeclinedUpdateFor: '11.0.16.10659' })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: '11.0.16.10659' });
  });

  it('reads a value it doesn’t know as the default', () => {
    expect(storedCmChoice({ cmChoice: 'installed', cmDeclinedUpdateFor: null })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'managed', cmDeclinedUpdateFor: 42 })).toEqual({ cmChoice: 'managed', cmDeclinedUpdateFor: null });
  });
});
