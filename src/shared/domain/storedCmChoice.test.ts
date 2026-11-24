import { describe, expect, it } from 'vitest';
import { storedCmChoice } from './storedCmChoice';

describe('storedCmChoice', () => {
  it('moves the app’s own, saved before the automatic choice existed, to it once', () => {
    expect(storedCmChoice({ cmChoice: 'managed' })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({})).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
  });

  it('keeps the installed one, which was always the user’s choice', () => {
    expect(storedCmChoice({ cmChoice: 'installed' })).toEqual({ cmChoice: 'installed', cmDeclinedUpdateFor: null });
  });

  it('keeps every choice saved since', () => {
    expect(storedCmChoice({ cmChoice: 'managed', cmDeclinedUpdateFor: null })).toEqual({ cmChoice: 'managed', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'installed', cmDeclinedUpdateFor: null })).toEqual({ cmChoice: 'installed', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'automatic', cmDeclinedUpdateFor: '11.0.16.10659' })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: '11.0.16.10659' });
  });

  it('reads a value it doesn’t know as the default', () => {
    expect(storedCmChoice({ cmChoice: 'bundled', cmDeclinedUpdateFor: null })).toEqual({ cmChoice: 'automatic', cmDeclinedUpdateFor: null });
    expect(storedCmChoice({ cmChoice: 'managed', cmDeclinedUpdateFor: 42 })).toEqual({ cmChoice: 'managed', cmDeclinedUpdateFor: null });
  });
});
