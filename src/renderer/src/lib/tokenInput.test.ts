import { describe, expect, it } from 'vitest';
import { addTokens, allTokens, tokenKey, typedTokens, withoutToken } from './tokenInput';

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
    expect(allTokens('ab"c')).toEqual(['abc']);
    expect(allTokens('.cs ab"c d')).toEqual(['.cs', 'abc d']);
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

describe('tokenKey', () => {
  const chips = ['.cs', '.vb', '.java'];

  it('takes the last chip away with Backspace in an empty input, and moves onto it with ArrowLeft', () => {
    expect(tokenKey('Backspace', 'input', chips, '')).toEqual({ tokens: ['.cs', '.vb'], focus: 'input' });
    expect(tokenKey('ArrowLeft', 'input', chips, '')).toEqual({ tokens: chips, focus: 2 });
  });

  it('leaves keys to the input while it holds text, or with no chip', () => {
    expect(tokenKey('Backspace', 'input', chips, '.ja')).toBeNull();
    expect(tokenKey('ArrowLeft', 'input', chips, '.ja')).toBeNull();
    expect(tokenKey('Backspace', 'input', [], '')).toBeNull();
    expect(tokenKey('a', 'input', chips, '')).toBeNull();
  });

  it('moves between chips, back to the input past the last', () => {
    expect(tokenKey('ArrowLeft', 1, chips, '')).toEqual({ tokens: chips, focus: 0 });
    expect(tokenKey('ArrowLeft', 0, chips, '')).toEqual({ tokens: chips, focus: 0 });
    expect(tokenKey('ArrowRight', 1, chips, '')).toEqual({ tokens: chips, focus: 2 });
    expect(tokenKey('ArrowRight', 2, chips, '')).toEqual({ tokens: chips, focus: 'input' });
  });

  it('removes the chip it’s on: Backspace goes to the one before, Delete stays where it was', () => {
    expect(tokenKey('Backspace', 1, chips, '')).toEqual({ tokens: ['.cs', '.java'], focus: 0 });
    expect(tokenKey('Backspace', 0, chips, '')).toEqual({ tokens: ['.vb', '.java'], focus: 0 });
    expect(tokenKey('Delete', 1, chips, '')).toEqual({ tokens: ['.cs', '.java'], focus: 1 });
    expect(tokenKey('Delete', 2, chips, '')).toEqual({ tokens: ['.cs', '.vb'], focus: 'input' });
    expect(tokenKey('Delete', 0, ['.cs'], '')).toEqual({ tokens: [], focus: 'input' });
  });
});

describe('withoutToken', () => {
  it('takes away the value whose chip was closed, and no other of the same text', () => {
    expect(withoutToken(['.cs', '.vb', '.java'], 1)).toEqual(['.cs', '.java']);
  });
});
