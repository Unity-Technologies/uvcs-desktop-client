import { describe, expect, it } from 'vitest';
import { goToLineError, goToLineQuestion, lineToGoTo } from './goToLine';

describe('goToLineQuestion', () => {
  it("asks for a line of the side, saying how many it has, the current one in the field", () => {
    expect(goToLineQuestion(240, 42)).toEqual({ title: 'Go to line', label: 'Line number (1–240)', initialValue: '42' });
  });

  it('starts empty where no line is current, and with a line the side has otherwise', () => {
    expect(goToLineQuestion(240, null).initialValue).toBe('');
    expect(goToLineQuestion(10, 12).initialValue).toBe('10');
  });

  it('says so of a text with one line', () => {
    expect(goToLineQuestion(1, 1).label).toBe('Line number (the text has one line)');
  });
});

describe('the line typed', () => {
  it('takes a line the side has, around spaces', () => {
    expect(lineToGoTo('42', 240)).toBe(42);
    expect(lineToGoTo(' 240 ', 240)).toBe(240);
    expect(lineToGoTo('1', 1)).toBe(1);
    expect(goToLineError('7', 240)).toBeUndefined();
  });

  it('refuses anything but a whole number, saying what to type', () => {
    for (const typed of ['', 'abc', '4.5', '-3', '1e3', '٤٢', '12a', '+5']) {
      expect(lineToGoTo(typed, 240), typed).toBeNull();
      expect(goToLineError(typed, 240), typed).toBe('Type a line number');
    }
  });

  it('refuses a line the side lacks, saying which it has', () => {
    expect(goToLineError('0', 240)).toBe('Type a number from 1 to 240');
    expect(goToLineError('241', 240)).toBe('Type a number from 1 to 240');
    expect(goToLineError('99999999999999', 240)).toBe('Type a line number');
    expect(goToLineError('2', 1)).toBe('The text has one line');
    expect(lineToGoTo('241', 240)).toBeNull();
  });
});
