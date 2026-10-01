import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { UnexpectedError } from '@shared/events';
import { filesUnder, isAppSource } from '@shared/testing/filesUnder';
import { describeUnexpectedError, handleUnexpectedErrors } from './unexpectedErrors';

function handled() {
  const process = new EventEmitter();
  const reported: UnexpectedError[] = [];
  const logged: string[] = [];
  handleUnexpectedErrors(process, (error) => reported.push(error), (text) => logged.push(text));
  return { process, reported, logged };
}

describe('handleUnexpectedErrors', () => {
  it('reports an uncaught exception to the user and logs its stack', () => {
    const { process, reported, logged } = handled();
    const error = new RangeError('Invalid string length');

    process.emit('uncaughtException', error);

    expect(reported).toEqual([{ message: 'Invalid string length', details: error.stack }]);
    expect(logged).toEqual([`Unexpected error (uncaught exception): ${error.stack}`]);
  });

  it('reports a rejection no one waited for, whatever it was rejected with', () => {
    const { process, reported } = handled();

    process.emit('unhandledRejection', 'the server went away', Promise.resolve());

    expect(reported).toEqual([{ message: 'the server went away', details: 'the server went away' }]);
  });

  it('reports an error that repeats once, and logs every time', () => {
    const { process, reported, logged } = handled();

    for (let time = 0; time < 3; time++) process.emit('uncaughtException', new Error('write EPIPE'));
    process.emit('uncaughtException', new Error('another one'));

    expect(reported.map((error) => error.message)).toEqual(['write EPIPE', 'another one']);
    expect(logged).toHaveLength(4);
  });

  it('only logs a report that fails, never throwing back from the handler', () => {
    const process = new EventEmitter();
    const logged: string[] = [];
    handleUnexpectedErrors(
      process,
      () => {
        throw new Error('the window is gone');
      },
      (text) => logged.push(text),
    );

    expect(() => process.emit('uncaughtException', new Error('first'))).not.toThrow();
    expect(logged[1]).toContain('the window is gone');
  });
});

describe('describeUnexpectedError', () => {
  it('hides the secrets an error quotes, in its message and its stack', () => {
    const error = new Error('cm sync r git https://ana:ghp_123@example.com/game --pwd=s3cret failed');
    expect(JSON.stringify(describeUnexpectedError(error))).not.toMatch(/s3cret|ghp_123/);
  });

  it('names an error without a message by its kind', () => {
    const error = new TypeError();
    expect(describeUnexpectedError(error).message).toBe('TypeError');
  });
});

describe("main's entry", () => {
  const MAIN_DIRECTORY = join(__dirname, '..');
  const source = (file: string): string => readFileSync(join(MAIN_DIRECTORY, file), 'utf8');

  it('installs the handlers before any other module runs: its first import', () => {
    const firstImport = source('index.ts').match(/^import .*$/m)?.[0];
    expect(firstImport).toBe("import './errors/installUnexpectedErrorHandlers';");
  });

  it('installs them in one place', () => {
    const installers = filesUnder(MAIN_DIRECTORY, isAppSource).filter((file) => /'(uncaughtException|unhandledRejection)'/.test(readFileSync(file, 'utf8')));
    expect(installers.map((file) => file.slice(MAIN_DIRECTORY.length + 1).replaceAll('\\', '/'))).toEqual(['errors/unexpectedErrors.ts']);
  });

  it("leaves no timer of a cm shell session unguarded: a throw there would escape the command's promise", () => {
    const session = source(join('cm', 'CmShellSession.ts'));
    const timers = [...session.matchAll(/\bset(Timeout|Immediate)\(/g)].map((match) => session.slice(match.index, match.index + 120));
    expect(timers.length).toBeGreaterThan(0);
    for (const timer of timers) expect(timer).toContain('this.guarded(');
  });
});
