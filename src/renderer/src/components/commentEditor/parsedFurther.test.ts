import { describe, expect, it } from 'vitest';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorState, StateEffect } from '@codemirror/state';
import { commentMarkdown } from './commentLanguage';
import { parsedFurther } from './parsedFurther';

// Built with `EditorState.create`, not `editorState`, which parses the whole text: these need the parse a new state starts with.
function newState(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [commentMarkdown()] });
}

const longComment = `${'Some words before the code.\n'.repeat(200)}\`\`\`ts\nlet a = 1;\n\`\`\``;

describe('parsedFurther', () => {
  it('is true once the parse has gone past where a new state stopped (its first 3,000 characters)', () => {
    const start = newState(longComment);
    ensureSyntaxTree(start, start.doc.length, Infinity);
    expect(parsedFurther(start, start.update({}).state)).toBe(true);
  });

  it('is false for a caret moved or an effect sent, with nothing more parsed', () => {
    const start = newState('Look:\n```ts\nlet a = 1;\n```');
    expect(parsedFurther(start, start.update({ selection: { anchor: 2 } }).state)).toBe(false);
    expect(parsedFurther(start, start.update({ effects: StateEffect.define<null>().of(null) }).state)).toBe(false);
  });
});
