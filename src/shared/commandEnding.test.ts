import { describe, expect, it } from 'vitest';
import { commandEnding, entryEnding } from './commandEnding';

describe('entryEnding', () => {
  it('words a command by its exit code, and an issue tracker’s request by its answer’s status', () => {
    expect(commandEnding(-1)).toBe('Stopped');
    expect(entryEnding({ exitCode: 1 })).toBe('Exit code 1');
    expect(entryEnding({ exitCode: 1, source: 'tracker', httpStatus: 404 })).toBe('HTTP 404');
    expect(entryEnding({ exitCode: 1, source: 'tracker' })).toBe('No answer');
  });
});
