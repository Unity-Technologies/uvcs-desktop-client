import { describe, expect, it } from 'vitest';
import { editorState, run, written } from './commentEditorTesting';
import { indentLines, outdentLines } from './focusModeTab';

const indent = (text: string) => {
  const next = run(indentLines, editorState(text));
  return next && written(next);
};
const outdent = (text: string) => {
  const next = run(outdentLines, editorState(text));
  return next && written(next);
};

describe('indentLines', () => {
  it('nests a list item under the one above by its marker’s width, a task keeping its box', () => {
    expect(indent('- one\n- two‸')).toBe('- one\n  - two‸');
    expect(indent('1. one\n2. two‸')).toBe('1. one\n   2. two‸');
    expect(indent('- [ ] one\n- [ ] two‸')).toBe('- [ ] one\n  - [ ] two‸');
  });

  it('indents a code block’s line by the block’s own indent, or four spaces in a block with none', () => {
    expect(indent('```\nif (a)\n‸b\n```')).toBe('```\nif (a)\n    ‸b\n```');
    expect(indent('```\nif (a)\n\tb\n‸c\n```')).toBe('```\nif (a)\n\tb\n\t‸c\n```');
    expect(indent('```\nif (a)\n  b\n‸c\n```')).toBe('```\nif (a)\n  b\n  ‸c\n```');
  });

  it('leaves a paragraph’s line alone: four spaces would make it a code block', () => {
    expect(indent('Fix the ‸switch')).toBe('Fix the ‸switch');
  });

  it('indents every line of a selection over several, each by its own kind', () => {
    expect(indent('- «one\n- two»')).toBe('  - «one\n  - two»');
  });
});

describe('outdentLines', () => {
  it('takes a nested item back out by its marker’s width, and a code line by the block’s indent', () => {
    expect(outdent('- one\n  - two‸')).toBe('- one\n- two‸');
    expect(outdent('```\nif (a)\n    ‸b\n```')).toBe('```\nif (a)\n‸b\n```');
  });

  it('leaves a line with nothing to take back as it is', () => {
    expect(outdent('- one‸')).toBe('- one‸');
    expect(outdent('Fix ‸it')).toBe('Fix ‸it');
  });
});
