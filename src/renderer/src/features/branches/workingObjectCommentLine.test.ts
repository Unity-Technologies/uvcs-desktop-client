import { describe, expect, it } from 'vitest';
import { workingObjectCommentLine } from './workingObjectCommentLine';

describe('workingObjectCommentLine', () => {
  it('holds the line with a placeholder while the comment loads', () => {
    expect(workingObjectCommentLine(undefined, false, false)).toEqual({ kind: 'loading' });
  });

  it('shows the comment’s first line as text', () => {
    expect(workingObjectCommentLine('Snappier steering\r\n\r\nTuned the turn rate.', false, false)).toEqual({ kind: 'text', text: 'Snappier steering' });
  });

  it('says there is no comment when it is empty or blank', () => {
    expect(workingObjectCommentLine('', false, false)).toEqual({ kind: 'noComment' });
    expect(workingObjectCommentLine('  \n', false, false)).toEqual({ kind: 'noComment' });
  });

  it('shows no second line while switching, nor when the comment couldn’t be read', () => {
    expect(workingObjectCommentLine('Snappier steering', false, true)).toEqual({ kind: 'none' });
    expect(workingObjectCommentLine(undefined, true, false)).toEqual({ kind: 'none' });
  });
});
