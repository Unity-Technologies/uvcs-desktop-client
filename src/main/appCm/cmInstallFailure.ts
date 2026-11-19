import type { CmInstallFailure } from '@shared/domain/appCm';

/** A failure to set up the app's `cm` whose kind is already known: an HTTP answer, a hash that differs. */
export class CmInstallError extends Error {
  constructor(
    readonly failure: CmInstallFailure,
    message: string,
  ) {
    super(message);
    this.name = 'CmInstallError';
  }
}

/** The kind of an HTTP answer that isn't the bundle. */
export function httpFailure(status: number): CmInstallFailure {
  if (status === 407) return 'proxyAuthentication';
  // The site answers 403 for a bundle never published or removed, as its storage does for a missing file.
  if (status === 403 || status === 404 || status === 410) return 'unavailable';
  return 'unreachable';
}

const SYSTEM_ERRORS: Readonly<Record<string, CmInstallFailure>> = {
  ENOSPC: 'diskFull',
  EDQUOT: 'diskFull',
  EACCES: 'notWritable',
  EPERM: 'notWritable',
  EROFS: 'notWritable',
  ENOTFOUND: 'offline',
  EAI_AGAIN: 'offline',
  ENETUNREACH: 'offline',
  ENETDOWN: 'offline',
};

/**
 * Chromium's network errors (Electron's `net.fetch` rejects with `net::ERR_…`) that mean the computer has no network,
 * rather than a site that doesn't answer.
 */
const OFFLINE_NET_ERRORS = ['ERR_INTERNET_DISCONNECTED', 'ERR_NAME_NOT_RESOLVED', 'ERR_NETWORK_CHANGED', 'ERR_ADDRESS_UNREACHABLE', 'ERR_NAME_RESOLUTION_FAILED'];

function codeOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string') return code;
  // Node's fetch rejects with "fetch failed" and the system error as its cause.
  return codeOf((error as { cause?: unknown }).cause);
}

/** What kind of failure an error from downloading, unpacking or checking the app's `cm` is. */
export function cmInstallFailureOf(error: unknown): CmInstallFailure {
  if (error instanceof CmInstallError) return error.failure;
  const code = codeOf(error);
  if (code && SYSTEM_ERRORS[code]) return SYSTEM_ERRORS[code];
  const message = error instanceof Error ? error.message : String(error);
  if (/ERR_PROXY_AUTH|ERR_PROXY_CONNECTION_FAILED.*407/.test(message)) return 'proxyAuthentication';
  if (OFFLINE_NET_ERRORS.some((name) => message.includes(name))) return 'offline';
  return 'unreachable';
}
