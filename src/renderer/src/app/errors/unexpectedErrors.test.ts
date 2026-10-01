import { describe, expect, it } from 'vitest';
import { describeWindowError, unexpectedErrorIssueUrl } from './unexpectedErrors';

const INFO = {
  version: '1.4.0',
  platform: 'darwin',
  arch: 'arm64',
  electron: '38.1.0',
  chromium: '140.0.7339.80',
  issuesUrl: 'https://github.com/Unity-Technologies/uvcs-desktop-client/issues/new',
};

const paramsOf = (url: string) => Object.fromEntries(new URL(url).searchParams);

describe('describeWindowError', () => {
  it('takes an error with its stack', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'id')");
    expect(describeWindowError(error)).toEqual({ message: "Cannot read properties of undefined (reading 'id')", details: error.stack });
  });

  it('takes a rejection with something else than an error', () => {
    expect(describeWindowError('timed out')).toEqual({ message: 'timed out', details: 'timed out' });
  });

  it("takes the event's message when there is no error, as for a script that failed to load", () => {
    expect(describeWindowError(undefined, 'Script error.')).toEqual({ message: 'Script error.', details: 'Script error.' });
  });

  it('leaves out what is no failure: a ResizeObserver running again on the next frame', () => {
    expect(describeWindowError(undefined, 'ResizeObserver loop completed with undelivered notifications.')).toBeNull();
  });
});

describe('unexpectedErrorIssueUrl', () => {
  it('opens the bug report titled with the error, with the app details and its stack', () => {
    const error = { message: 'Invalid string length', details: 'RangeError: Invalid string length\n    at OutputBuffer.textBefore (index.js:160:24)' };
    expect(paramsOf(unexpectedErrorIssueUrl(INFO, undefined, error))).toEqual({
      template: 'bug_report.yml',
      title: 'Something went wrong: Invalid string length',
      'app-details': ['Unity Version Control: 1.4.0', 'cm: unknown', 'Platform: macOS · arm64', 'Electron: 38.1.0', 'Chromium: 140.0.7339.80'].join('\n'),
      'error-details': error.details,
    });
  });
});
