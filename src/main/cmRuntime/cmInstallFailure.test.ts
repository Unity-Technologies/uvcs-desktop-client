import { describe, expect, it } from 'vitest';
import { cmInstallFailureOf, CmInstallError, httpFailure } from './cmInstallFailure';

function systemError(code: string): Error {
  return Object.assign(new Error(`${code}: something`), { code });
}

describe('cmInstallFailureOf', () => {
  it('keeps the kind an install error already knows', () => {
    expect(cmInstallFailureOf(new CmInstallError('damaged', 'SHA-256 differs'))).toBe('damaged');
  });

  it('tells a full disk and a folder that can’t be written', () => {
    expect(cmInstallFailureOf(systemError('ENOSPC'))).toBe('diskFull');
    expect(cmInstallFailureOf(systemError('EACCES'))).toBe('notWritable');
    expect(cmInstallFailureOf(systemError('EPERM'))).toBe('notWritable');
  });

  it('reads the system error under Node fetch’s "fetch failed"', () => {
    expect(cmInstallFailureOf(new TypeError('fetch failed', { cause: systemError('ENOTFOUND') }))).toBe('offline');
    expect(cmInstallFailureOf(new TypeError('fetch failed', { cause: systemError('ECONNREFUSED') }))).toBe('unreachable');
  });

  it('tells Chromium’s errors for no network from a site that doesn’t answer', () => {
    expect(cmInstallFailureOf(new Error('net::ERR_INTERNET_DISCONNECTED'))).toBe('offline');
    expect(cmInstallFailureOf(new Error('net::ERR_NAME_NOT_RESOLVED'))).toBe('offline');
    expect(cmInstallFailureOf(new Error('net::ERR_CONNECTION_TIMED_OUT'))).toBe('unreachable');
    expect(cmInstallFailureOf(new Error('net::ERR_CERT_AUTHORITY_INVALID'))).toBe('unreachable');
    expect(cmInstallFailureOf(new Error('net::ERR_PROXY_AUTH_UNSUPPORTED'))).toBe('proxyAuthentication');
  });
});

describe('httpFailure', () => {
  it('reads a missing bundle, a proxy sign-in and a site in trouble', () => {
    expect(httpFailure(403)).toBe('unavailable');
    expect(httpFailure(404)).toBe('unavailable');
    expect(httpFailure(407)).toBe('proxyAuthentication');
    expect(httpFailure(503)).toBe('unreachable');
  });
});
