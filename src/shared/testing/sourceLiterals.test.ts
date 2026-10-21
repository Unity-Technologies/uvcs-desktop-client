import { describe, expect, it } from 'vitest';
import { literalsOf, withoutComments } from './sourceLiterals';

describe('withoutComments', () => {
  it('drops line and block comments, and keeps what strings hold', () => {
    expect(withoutComments("a(); // b\nc(/* d */ 'http://e', \"/* f */\");")).toBe("a(); \nc( 'http://e', \"/* f */\");");
  });

  it('ends a quote at its line, so an apostrophe in JSX text hides no comment below it', () => {
    expect(withoutComments("<p>Don't</p>\n// gone\nx")).toBe("<p>Don't</p>\n\nx");
  });
});

describe('literalsOf', () => {
  it('reads strings with their escapes undone, and no comments', () => {
    expect(literalsOf("// '.plastic'\nconst a = 'it\\'s'; /* 'no' */ const b = \"C:\\\\ws\";")).toEqual(["it's", 'C:\\ws']);
  });

  it('reads a template whole, the literals in its expressions included', () => {
    expect(literalsOf("`${root}/.plastic/${ok ? 'plastic.selector' : 'x'}`")).toEqual(["${root}/.plastic/${ok ? 'plastic.selector' : 'x'}"]);
  });

  it('reads regular expressions, and leaves divisions out', () => {
    expect(literalsOf("const re = /^\\.plastic(?:[\\\\/]|$)/; const half = a / b / 'c';")).toEqual(['^.plastic(?:[\\/]|$)', 'c']);
  });

  it('reads an escaped letter as a space, so `\\b` or `\\s` joins no word', () => {
    expect(literalsOf("/\\.plastic\\b/.test(a) || /\\s\\.plastic/.test(b) || 'a\\nb'")).toEqual(['.plastic ', ' .plastic', 'a b']);
  });
});
