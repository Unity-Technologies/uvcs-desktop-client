import { describe, expect, it } from 'vitest';
import { FORMAT_ACTIONS, formatsOf } from './formatActions';

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
