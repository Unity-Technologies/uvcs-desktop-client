import type { OneObjectRead } from '@shared/api/oneObjectRead';
import type { CmClient, CmRecordsOptions } from '../cm/CmClient';
import type { ReadRecord } from '../cm/formatRecords';

/**
 * How long a read in a process of its own (`ownProcess`: an object on another server) waits. `cm` asks nothing on
 * a closed stdin, but a server with browser sign-in and no profile waits for a sign-in that never comes, and an
 * unknown host for its connection to fail: the read gives up rather than hold a process for minutes.
 */
export const OWN_PROCESS_READ_TIMEOUT_MS = 30_000;

/**
 * Reads one object's `cm find` records: in the pooled shell, or in a process of its own that gives up (`read`), killed
 * outright (`SIGKILL`) as the other reads that may hang on a sign-in are. The command log keeps it (`CmClient`: a
 * timeout's abort is logged, a caller's cancellation isn't).
 */
export async function readOneObject<T>(cm: CmClient, args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions, read: OneObjectRead = {}): Promise<T[]> {
  if (!read.ownProcess) return cm.queryRecords(args, readRecord, options);
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(new DOMException('No answer in time', 'TimeoutError')), OWN_PROCESS_READ_TIMEOUT_MS);
  try {
    return await cm.executeRecords(args, readRecord, { ...options, signal: timer.signal, killSignal: 'SIGKILL' });
  } finally {
    clearTimeout(timeout);
  }
}
