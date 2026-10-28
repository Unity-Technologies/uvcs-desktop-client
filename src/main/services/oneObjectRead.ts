import type { OneObjectRead } from '@shared/api/oneObjectRead';
import type { CmClient, CmRecordsOptions } from '../cm/CmClient';
import type { ReadRecord } from '../cm/formatRecords';

/**
 * How long a read in a process of its own (`ownProcess`: an object on another server) waits. `cm` asks nothing on
 * a closed stdin, but a server with browser sign-in and no profile waits for a sign-in that never comes, and an
 * unknown host for its connection to fail: the read gives up rather than hold a process for minutes.
 */
export const OWN_PROCESS_READ_TIMEOUT_MS = 30_000;

/** Reads one object's `cm find` records: in the pooled shell, or in a process of its own that gives up (`read`). */
export function readOneObject<T>(cm: CmClient, args: string[], readRecord: ReadRecord<T>, options: CmRecordsOptions, read: OneObjectRead = {}): Promise<T[]> {
  if (!read.ownProcess) return cm.queryRecords(args, readRecord, options);
  return cm.executeRecords(args, readRecord, { ...options, signal: AbortSignal.timeout(OWN_PROCESS_READ_TIMEOUT_MS) });
}
