import { describe, expect, it } from 'vitest';
import { changeToMatch, oneLineText } from './commentFieldText';

describe('oneLineText', () => {
  it('joins pasted lines with a space, whatever their line ends', () => {
    expect(oneLineText('Merge the task\r\n  into main\nnow')).toBe('Merge the task into main now');
    expect(oneLineText('One line')).toBe('One line');
  });
});

describe('changeToMatch', () => {
  it('changes only what differs', () => {
    expect(changeToMatch('Fix the switch', 'Fix the old switch')).toEqual({ from: 8, to: 8, insert: 'old ' });
    expect(changeToMatch('abc', '')).toEqual({ from: 0, to: 3, insert: '' });
    expect(changeToMatch('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
  });

  it('takes Windows line ends as the editor keeps them, and is null for the same text', () => {
    expect(changeToMatch('one\ntwo', 'one\r\ntwo')).toBeNull();
    expect(changeToMatch('same', 'same')).toBeNull();
  });
});
