import { describe, expect, it } from 'vitest';
import { editorState } from './commentEditorTesting';
import { fencedCodeIn, tokenMarks } from './codeHighlight';
import { withCommentedFile } from './commentedFileLanguage';

describe('fencedCodeIn', () => {
  it('finds each code block with a language, and its code', () => {
    const state = editorState('Look:\n```ts\nlet a = 1;\nlet b;\n```\n```\nplain\n```\n```C#\nvar c;\n```');
    expect(fencedCodeIn(state)).toEqual([
      { from: 12, text: 'let a = 1;\nlet b;', language: 'ts' },
      { from: 54, text: 'var c;', language: 'c#' },
    ]);
  });
});

describe('fencedCodeIn, for a suggestion', () => {
  const suggestion = 'Say it:\n```suggestion\nLog($"Switched to {target}");\n```';

  it("colors a suggestion's code in the language of the file the comment is on", () => {
    expect(fencedCodeIn(editorState(suggestion, withCommentedFile('Assets/Scripts/SwitchFlow.cs')))).toEqual([{ from: 22, text: 'Log($"Switched to {target}");', language: 'csharp' }]);
  });

  it('leaves it plain on no file, or one whose language is not known', () => {
    expect(fencedCodeIn(editorState(suggestion))).toEqual([]);
    expect(fencedCodeIn(editorState(suggestion, withCommentedFile('notes.unknownext')))).toEqual([]);
  });
});

describe('fencedCodeIn, for a block too big to highlight', () => {
  it('leaves a pasted log past the comments’ limit plain, as the shown comment does', () => {
    // One long line: the parse reads it at once, where thousands of lines would take it past its time budget.
    const log = 'Build step done. '.repeat(1250);
    expect(fencedCodeIn(editorState(`\`\`\`text\n${log}\n\`\`\``))).toEqual([]);
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
