import { describe, expect, it } from 'vitest';
import { EMOTICON_EMOJI, emoticonEnding, endsEmoticon, insideOpenCodeSpan } from './emoticons';

describe('EMOTICON_EMOJI', () => {
  it('gives each emoticon the emoji people expect', () => {
    expect(EMOTICON_EMOJI[':-)']).toBe('🙂');
    expect(EMOTICON_EMOJI[';)']).toBe('😉');
    expect(EMOTICON_EMOJI[':D']).toBe('😄');
    expect(EMOTICON_EMOJI[':(']).toBe('🙁');
    expect(EMOTICON_EMOJI[":'("]).toBe('😢');
    expect(EMOTICON_EMOJI[':-p']).toBe('😛');
    expect(EMOTICON_EMOJI[':O']).toBe('😮');
    expect(EMOTICON_EMOJI[':-|']).toBe('😐');
    expect(EMOTICON_EMOJI[':-/']).toBe('😕');
  });

  it('gives each one emoji of one character, which Backspace takes whole and every client shows', () => {
    for (const emoji of Object.values(EMOTICON_EMOJI)) expect([...emoji]).toHaveLength(1);
  });

  it('leaves out what a comment means as written: a path, a word, a comparison, list items, a table', () => {
    for (const text of [':/', 'XD', '<3', '8)', 'B-)', ':|']) expect(EMOTICON_EMOJI[text]).toBeUndefined();
  });
});

describe('emoticonEnding', () => {
  it('finds an emoticon at the end of the text, with where it starts', () => {
    expect(emoticonEnding('Done :-)')).toEqual({ from: 5, emoticon: ':-)', emoji: '🙂' });
  });

  it('finds one at the start of the text and after an opening bracket', () => {
    expect(emoticonEnding(';)')?.emoji).toBe('😉');
    expect(emoticonEnding('(works :D')?.from).toBe(7);
    expect(emoticonEnding('(:D')?.from).toBe(1);
    expect(emoticonEnding('[:P')?.emoticon).toBe(':P');
  });

  it('takes the longest emoticon, never a part of it', () => {
    expect(emoticonEnding('ok :-(')?.emoticon).toBe(':-(');
    expect(emoticonEnding("sad :'(")?.emoticon).toBe(":'(");
  });

  it('finds none inside a word, a path or an address', () => {
    for (const text of ['a:-)', 'http://host:8080', 'https://example.com/:-)', 'C:D', 'fn(x:)', 'Plan:P', 'x:-D']) {
      expect(emoticonEnding(text)).toBeNull();
    }
  });

  it('finds none that is only the start of the text typed', () => {
    expect(emoticonEnding(':-)x')).toBeNull();
    expect(emoticonEnding('Note:')).toBeNull();
  });

  it('reads Unicode and tabs around it as any text', () => {
    expect(emoticonEnding('¡Listo!\t:-D')?.emoji).toBe('😄');
    expect(emoticonEnding('完成 :)')?.from).toBe(3);
  });
});

describe('endsEmoticon', () => {
  it('is a space or the punctuation that ends a phrase', () => {
    for (const key of [' ', '.', ',', '!', '?']) expect(endsEmoticon(key)).toBe(true);
  });

  it('is no other key, nor a closing bracket that may be part of the text', () => {
    for (const key of ['a', ')', ':', '-', '\t', '  ', '']) expect(endsEmoticon(key)).toBe(false);
  });
});

describe('insideOpenCodeSpan', () => {
  it('is true after a backtick no other has closed', () => {
    expect(insideOpenCodeSpan('run `x :-)')).toBe(true);
    expect(insideOpenCodeSpan('a `b` and ``c ` :)')).toBe(true);
  });

  it('is false once a run of the same length closes it', () => {
    expect(insideOpenCodeSpan('run `x` :-)')).toBe(false);
    expect(insideOpenCodeSpan('a ``b ` c`` :)')).toBe(false);
    expect(insideOpenCodeSpan('no code :)')).toBe(false);
  });
});
