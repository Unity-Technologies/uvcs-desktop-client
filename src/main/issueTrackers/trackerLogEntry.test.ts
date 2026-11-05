import { describe, expect, it } from 'vitest';
import { trackerLogEntry } from './trackerLogEntry';

describe('trackerLogEntry', () => {
  it('logs a request as its method, host and path, with its status', () => {
    expect(trackerLogEntry({ method: 'POST', host: 'acme.atlassian.net', path: '/rest/api/3/issue/bulkfetch', startedAt: 5, durationMs: 120, httpStatus: 200 })).toEqual({
      commandLine: 'POST acme.atlassian.net/rest/api/3/issue/bulkfetch',
      cwd: '',
      startedAt: 5,
      durationMs: 120,
      exitCode: 0,
      viaShell: false,
      output: '',
      source: 'tracker',
      httpStatus: 200,
    });
  });

  it('logs a failure by its words only, with no status when no answer came', () => {
    expect(trackerLogEntry({ method: 'GET', host: 'api.github.com', path: '/user', startedAt: 0, durationMs: 1, failure: "api.github.com couldn't be reached" })).toMatchObject({
      exitCode: 1,
      output: "api.github.com couldn't be reached",
      source: 'tracker',
    });
  });
});
