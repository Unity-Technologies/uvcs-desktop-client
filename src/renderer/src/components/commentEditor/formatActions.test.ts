import { describe, expect, it } from 'vitest';
import { FORMAT_ACTIONS, formatsOf, startsBlocks } from './formatActions';

describe('FORMAT_ACTIONS', () => {
  it('lists the formats once, the inline ones first, each with its name and, but the task list, its key', () => {
    expect(FORMAT_ACTIONS.map(({ id, label, shortcutId, block }) => [id, label, shortcutId ?? null, block])).toEqual([
      ['bold', 'Bold', 'commentBold', false],
      ['italic', 'Italic', 'commentItalic', false],
      ['strikethrough', 'Strikethrough', 'commentStrikethrough', false],
      ['code', 'Code', 'commentCode', false],
      ['link', 'Link', 'commentLink', false],
      ['bullet', 'List', 'commentList', true],
      ['task', 'Task list', null, true],
      ['numbered', 'Numbered list', 'commentNumberedList', true],
      ['quote', 'Quote', 'commentQuote', true],
      ['codeBlock', 'Code block', 'commentCodeBlock', true],
    ]);
  });
});

describe('formatsOf', () => {
  it('offers a one-line field the inline formats, and a comment of many lines the blocks too', () => {
    expect(formatsOf(true)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link']);
    expect(formatsOf(false)).toEqual(['bold', 'italic', 'strikethrough', 'code', 'link', 'bullet', 'task', 'numbered', 'quote', 'codeBlock']);
  });
});

describe('startsBlocks', () => {
  it('sets off the first block format shown from the inline ones, whichever formats a bar shows', () => {
    expect(FORMAT_ACTIONS.filter((action) => startsBlocks(FORMAT_ACTIONS, action.id)).map((action) => action.id)).toEqual(['bullet']);
    const noList = FORMAT_ACTIONS.filter((action) => action.id !== 'bullet');
    expect(noList.filter((action) => startsBlocks(noList, action.id)).map((action) => action.id)).toEqual(['task']);
    const inline = FORMAT_ACTIONS.filter((action) => !action.block);
    expect(inline.some((action) => startsBlocks(inline, action.id))).toBe(false);
  });
});
