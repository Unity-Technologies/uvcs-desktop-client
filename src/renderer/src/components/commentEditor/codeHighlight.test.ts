import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { fencedCodeIn, tokenMarks } from './codeHighlight';

describe('fencedCodeIn', () => {
  it('finds each code block with a language, and its code', () => {
    const state = editorState('Look:\n```ts\nlet a = 1;\nlet b;\n```\n```\nplain\n```\n```C#\nvar c;\n```');
    expect(fencedCodeIn(state)).toEqual([
      { from: 12, text: 'let a = 1;\nlet b;', language: 'ts' },
      { from: 54, text: 'var c;', language: 'c#' },
    ]);
  });
});

describe('fencedCodeIn, for a block too big to highlight', () => {
  it('leaves a pasted log past the comments’ limit plain, as the shown comment does', () => {
    const log = Array.from({ length: 5000 }, (_, line) => `line ${line} of the build log`).join('\n');
    const state = editorState(`\`\`\`text\n${log}\n\`\`\`\n\`\`\`ts\nlet a;\n\`\`\``);
    expect(fencedCodeIn(state).map((block) => block.language)).toEqual(['ts']);
  });
});

describe('tokenMarks', () => {
  it('places each colored token on the code, line after line', () => {
    const lines = [
      [
        { content: 'let', color: '#0000ff' },
        { content: ' a' },
      ],
      [{ content: 'b', color: '#ff0000', fontStyle: 1 }],
    ];
    expect(tokenMarks(10, lines)).toEqual([
      { from: 10, to: 13, style: 'color: #0000ff' },
      { from: 16, to: 17, style: 'color: #ff0000; font-style: italic' },
    ]);
  });
});
