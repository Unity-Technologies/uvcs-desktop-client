import { describe, expect, it } from 'vitest';
import type { UnexpectedError } from '@shared/events';
import { unexpectedErrorTeller } from './unexpectedErrorTeller';

function teller() {
  const told: string[] = [];
  const logged: string[] = [];
  const outlets = { tell: (error: UnexpectedError) => void told.push(error.message), log: (error: UnexpectedError) => void logged.push(error.message) };
  return { teller: unexpectedErrorTeller(outlets), told, logged };
}

describe('unexpectedErrorTeller', () => {
  it('tells and logs a window error that repeats once', () => {
    const { teller: errors, told, logged } = teller();

    for (let time = 0; time < 3; time++) errors.windowError(new Error('Cannot read properties of undefined'));
    errors.windowError(new Error('another one'));

    expect(told).toEqual(['Cannot read properties of undefined', 'another one']);
    expect(logged).toEqual(['Cannot read properties of undefined', 'another one']);
  });

  it('never tells nor logs what is no failure of the app', () => {
    const { teller: errors, told, logged } = teller();

    errors.windowError(null, 'ResizeObserver loop completed with undelivered notifications.');

    expect(told).toEqual([]);
    expect(logged).toEqual([]);
  });

  it('tells a main process error once and leaves its logging to main', () => {
    const { teller: errors, told, logged } = teller();
    const error = { message: 'write EPIPE', details: 'Error: write EPIPE' };

    errors.mainError(error);
    errors.mainError(error);

    expect(told).toEqual(['write EPIPE']);
    expect(logged).toEqual([]);
  });
});
