import { describe, expect, it } from 'vitest';
import { addTokens, afterBackspace, allTokens, typedTokens, withoutToken } from './tokenInput';

describe('typedTokens', () => {
  it('ends a value at a space, comma or semicolon, keeping what is still being typed', () => {
    expect(typedTokens('.cs ')).toEqual({ tokens: ['.cs'], rest: '' });
    expect(typedTokens('.cs,.vb;.java')).toEqual({ tokens: ['.cs', '.vb'], rest: '.java' });
    expect(typedTokens('.prefab')).toEqual({ tokens: [], rest: '.prefab' });
  });

  it('keeps separators inside double quotes, the quoted value still typed until its quote closes and a separator follows', () => {
    expect(typedTokens('"Assets/Third Party/**" ')).toEqual({ tokens: ['Assets/Third Party/**'], rest: '' });
    expect(typedTokens('"Assets/Third Par')).toEqual({ tokens: [], rest: '"Assets/Third Par' });
  });

  it('ends nothing for separators alone', () => {
    expect(typedTokens('  , ')).toEqual({ tokens: [], rest: '' });
  });
});

describe('allTokens', () => {
  it('takes every value, the last one too, as Enter, pasting or leaving the field do', () => {
    expect(allTokens('.unity .prefab\n.asset')).toEqual(['.unity', '.prefab', '.asset']);
    expect(allTokens('"My Level.unity"')).toEqual(['My Level.unity']);
    expect(allTokens('"Assets/Third Par')).toEqual(['Assets/Third Par']);
    expect(allTokens('   ')).toEqual([]);
  });
});

describe('addTokens', () => {
  it('adds new values after the others, each once', () => {
    expect(addTokens(['.cs', '.vb'], ['.java', '.cs', '.java'])).toEqual(['.cs', '.vb', '.java']);
  });

  it('keeps values that differ only in case, which Linux tells apart', () => {
    expect(addTokens(['.cs'], ['.CS'])).toEqual(['.cs', '.CS']);
  });
});

describe('afterBackspace', () => {
  it('takes the last value away from an empty field, and leaves a field with text to the text', () => {
    expect(afterBackspace(['.cs', '.vb'], '')).toEqual(['.cs']);
    expect(afterBackspace(['.cs', '.vb'], '.ja')).toBeNull();
    expect(afterBackspace([], '')).toBeNull();
  });
});

describe('withoutToken', () => {
  it('takes away the value whose chip was closed, and no other of the same text', () => {
    expect(withoutToken(['.cs', '.vb', '.java'], 1)).toEqual(['.cs', '.java']);
  });
});
