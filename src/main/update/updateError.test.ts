import { describe, expect, it } from 'vitest';
import { describeUpdateError, UpdateFailure, updateErrorForLog } from './updateError';

/** How electron-updater reports a failed `releases/latest` lookup: wrapped twice, then the response and the whole feed. */
const latestLookupFailure = new Error(
  'Cannot parse releases feed: Error: Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), ' +
    'please ensure a production release exists: HttpError: 406 \n"method: GET url: https://github.com/o/r/releases/latest"\n' +
    'Headers: {"set-cookie": "_gh_sess=secret"}\n    at GitHubProvider.getLatestTagName,\nXML:\n<feed><entry>v0.1.5</entry></feed>',
);

describe('describeUpdateError', () => {
  it('says the server is out of reach when offline, by code or by message', () => {
    const offline = "Couldn't reach the update server. Check your connection and try again.";
    expect(describeUpdateError(Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' }))).toBe(offline);
    expect(describeUpdateError(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe(offline);
  });

  it('says there is no release yet on a 404, never the response headers', () => {
    const response = 'HttpError: 404 \n"method: GET url: https://github.com/o/r/releases.atom"\nHeaders: {"set-cookie": "_gh_sess=secret"}';
    const described = describeUpdateError(Object.assign(new Error(response), { statusCode: 404 }));

    expect(described).toBe('No published release is available to update from yet.');
    expect(describeUpdateError(new Error(response))).not.toContain('secret');
  });

  it("shows the app's own failures as they are worded", () => {
    expect(describeUpdateError(new UpdateFailure('The download was damaged. Try again.'))).toBe('The download was damaged. Try again.');
  });

  it("says GitHub didn't answer as expected for any other failure, never electron-updater's words", () => {
    const unexpected = "GitHub didn't answer as expected. Try again in a moment.";
    expect(describeUpdateError(latestLookupFailure)).toBe(unexpected);
    expect(describeUpdateError(new Error('sha512 checksum mismatch'))).toBe(unexpected);
    expect(describeUpdateError('offline for a bit')).toBe(unexpected);
    expect(describeUpdateError(undefined)).toBe(unexpected);
  });
});

describe('updateErrorForLog', () => {
  it('keeps the whole cause chain, without the response headers or the feed', () => {
    expect(updateErrorForLog(latestLookupFailure)).toBe(
      'Cannot parse releases feed: Error: Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), ' +
        'please ensure a production release exists: HttpError: 406 \n"method: GET url: https://github.com/o/r/releases/latest"',
    );
  });

  it('logs the stack of an error with nothing to hide', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at check (AppUpdates.ts:101)';

    expect(updateErrorForLog(error)).toBe('Error: boom\n    at check (AppUpdates.ts:101)');
  });

  it('logs what is not an error as text', () => {
    expect(updateErrorForLog('offline for a bit')).toBe('offline for a bit');
  });
});
