import { describe, expect, it } from 'vitest';
import { history, undo } from '@codemirror/commands';
import { editorState, run, written } from './commentEditorTesting';
import { activeFormats, closeCodeFence, FORMAT_COMMANDS, linkFromPaste, type FormatCommandId } from './formatCommands';

function format(command: FormatCommandId, text: string): string | null {
  const next = run(FORMAT_COMMANDS[command], editorState(text));
  return next && written(next);
}

describe('inline formats', () => {
  it('wraps the selection, keeping it selected inside the marks', () => {
    expect(format('bold', 'Fix «the switch» now')).toBe('Fix **«the switch»** now');
    expect(format('italic', 'un«do»ne')).toBe('un*«do»*ne');
    expect(format('strikethrough', '«old»')).toBe('~~«old»~~');
    expect(format('code', 'call «run()» here')).toBe('call `«run()»` here');
  });

  it('opens both marks at a caret, to type between them', () => {
    expect(format('bold', 'Fix ‸')).toBe('Fix **‸**');
  });

  it('leaves the spaces at the selection’s edges outside the marks', () => {
    expect(format('bold', 'Fix« the »switch')).toBe('Fix« **the** »switch');
  });

  it('wraps each line of a selection over several, as marks never span lines', () => {
    expect(format('bold', '«one\n\ntwo»')).toBe('**«one**\n\n**two»**');
  });

  it('toggles: in bold, ⌘B takes the marks away and keeps the text', () => {
    expect(format('bold', 'Fix **the swi‸tch** now')).toBe('Fix the swi‸tch now');
    expect(format('bold', 'Fix **«the switch»** now')).toBe('Fix «the switch» now');
    expect(format('code', 'call `ru‸n()`')).toBe('call ru‸n()');
  });

  it('formats nothing inside code, where the marks would be its text', () => {
    expect(format('bold', '```\nlet ‸a = 1\n```')).toBeNull();
    expect(format('code', '```\nlet ‸a = 1\n```')).toBeNull();
  });
});

describe('line formats', () => {
  it('starts a list, a task list or a quote on the caret’s line, the caret moving with its text', () => {
    expect(format('bullet', 'one‸')).toBe('- one‸');
    expect(format('task', '‸')).toBe('- [ ] ‸');
    expect(format('quote', 'said ‸so')).toBe('> said ‸so');
  });

  it('formats every selected line but the blank ones', () => {
    expect(format('bullet', '«one\n\ntwo»')).toBe('- «one\n\n- two»');
  });

  it('turns a list into the other kind instead of adding a second marker', () => {
    expect(format('task', '- one‸')).toBe('- [ ] one‸');
    expect(format('bullet', '- [x] done‸')).toBe('- done‸');
    expect(format('bullet', '1. first‸')).toBe('- first‸');
  });

  it('toggles off when every line already is one', () => {
    expect(format('bullet', '«- one\n- two»')).toBe('«one\ntwo»');
    expect(format('quote', '> said‸')).toBe('said‸');
  });

  it('keeps an indented item’s indent', () => {
    expect(format('bullet', '  nested‸')).toBe('  - nested‸');
  });
});

describe('code blocks', () => {
  it('opens an empty one on a blank line, the caret inside', () => {
    expect(format('codeBlock', 'Look:\n‸')).toBe('Look:\n```\n‸\n```');
  });

  it('puts the selected lines in one, selected', () => {
    expect(format('codeBlock', 'let «a = 1\nlet b» = 2')).toBe('```\n«let a = 1\nlet b = 2»\n```');
  });

  it('takes the fences away from inside one, the code staying', () => {
    expect(format('codeBlock', '```ts\nlet ‸a = 1\n```')).toBe('let ‸a = 1');
  });
});

describe('links', () => {
  it('makes the selection a link’s text, `url` selected to paste the address over', () => {
    expect(format('link', 'See «the docs»')).toBe('See [the docs](«url»)');
    expect(format('link', 'See ‸')).toBe('See [](«url»)');
  });

  it('makes a selected address the link’s address, the caret where its text goes', () => {
    expect(format('link', '«https://example.com»')).toBe('[‸](https://example.com)');
  });

  it('unlinks inside a link, keeping its text', () => {
    expect(format('link', 'See [the d‸ocs](https://example.com) now')).toBe('See the d‸ocs now');
  });

  it('links the selected text to an address pasted on it', () => {
    expect(linkFromPaste(editorState('See «the docs»'), ' https://example.com\n')).toEqual({ from: 4, to: 12, insert: '[the docs](https://example.com)' });
    expect(linkFromPaste(editorState('See the docs‸'), 'https://example.com')).toBeNull();
    expect(linkFromPaste(editorState('See «the docs»'), 'not an address')).toBeNull();
    expect(linkFromPaste(editorState('`«code»`'), 'https://example.com')).toBeNull();
  });
});

describe('closeCodeFence', () => {
  it('closes a fence opened on Enter, the caret on the line between', () => {
    const next = run(closeCodeFence, editorState('Look:\n```csharp‸'));
    expect(next && written(next)).toBe('Look:\n```csharp\n‸\n```');
  });

  it('leaves Enter alone after a closing fence and inside a block', () => {
    expect(run(closeCodeFence, editorState('```\ncode\n```‸'))).toBeNull();
    expect(run(closeCodeFence, editorState('```\ncode‸\n```'))).toBeNull();
    expect(run(closeCodeFence, editorState('plain‸'))).toBeNull();
  });
});

describe('activeFormats', () => {
  it('says which formats the selection is in', () => {
    expect([...activeFormats(editorState('**Fix _the‸_**'))].sort()).toEqual(['bold', 'italic']);
    expect([...activeFormats(editorState('- [ ] write‸'))]).toEqual(['task']);
    expect([...activeFormats(editorState('- write‸'))]).toEqual(['bullet']);
    expect([...activeFormats(editorState('> said‸'))]).toEqual(['quote']);
    expect([...activeFormats(editorState('```\nco‸de\n```'))]).toEqual(['codeBlock']);
  });
});

it('undoes a format as one step', () => {
  const state = editorState('Fix «the switch» now', history());
  const formatted = run(FORMAT_COMMANDS.bold, state)!;
  const undone = run(undo, formatted)!;
  expect(written(undone)).toBe('Fix «the switch» now');
});
