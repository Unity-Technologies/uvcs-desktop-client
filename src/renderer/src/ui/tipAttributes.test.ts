import { describe, expect, it } from 'vitest';
import { moveTipAttributes, readTipAttributes } from './tipAttributes';

const element =
  (attributes: Record<string, string | undefined>) =>
  (name: string): string | null =>
    attributes[name] ?? null;

describe('readTipAttributes', () => {
  it('reads the text, its second line and its shortcut', () => {
    expect(readTipAttributes(element({ 'data-tip': 'Refresh', 'data-tip-sub': 'Up to date', 'data-tip-shortcut': 'mod+r' }))).toEqual({
      text: 'Refresh',
      sub: 'Up to date',
      shortcut: 'mod+r',
      move: undefined,
    });
  });

  it('shows nothing for an empty text', () => {
    expect(readTipAttributes(element({ 'data-tip': '' }))).toBeNull();
    expect(readTipAttributes(element({}))).toBeNull();
  });

  it('shows a move with or without words of its own', () => {
    const move = moveTipAttributes({ from: 'src/lib/A.cs', to: 'src/app/A.cs' });
    expect(readTipAttributes(element({ 'data-tip': '', ...move }))).toEqual({
      text: '',
      sub: undefined,
      shortcut: undefined,
      move: { from: 'src/lib/A.cs', to: 'src/app/A.cs' },
    });
    expect(readTipAttributes(element({ 'data-tip': 'Moved', ...move }))?.move).toEqual({ from: 'src/lib/A.cs', to: 'src/app/A.cs' });
  });

  it('needs both paths for a move', () => {
    expect(readTipAttributes(element({ 'data-tip': '', 'data-tip-move-from': 'src/lib/A.cs' }))).toBeNull();
  });
});
