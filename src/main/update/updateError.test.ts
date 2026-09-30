import { describe, expect, it } from 'vitest';
import { describeUpdateError } from './updateError';

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

  it('keeps only the first clause of any other failure, without its error type', () => {
    expect(describeUpdateError(new Error('Error: sha512 checksum mismatch\r\nexpected abc'))).toBe('sha512 checksum mismatch');
    expect(describeUpdateError(new Error('Something broke Headers: {"set-cookie": "x"}'))).toBe('Something broke');
  });

  it('cuts a long message short', () => {
    expect(describeUpdateError(new Error('x'.repeat(300)))).toBe(`${'x'.repeat(140)}…`);
  });

  it('describes what is not an error', () => {
    expect(describeUpdateError('offline for a bit')).toBe('offline for a bit');
    expect(describeUpdateError(undefined)).toBe('Unknown error');
  });
});
