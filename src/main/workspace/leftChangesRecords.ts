import type { LeftChanges, SwitchShelveRecord } from '@shared/domain/switchWithChanges';

/** A record of changes the app shelved to switch or update: never one the user shelved away. */
export type LeftChangesRecord = SwitchShelveRecord & { reason?: LeftChanges['reason'] };

/** Shelved by the app to switch or update, not by the user: only these are "Welcome back"'s, and restored on arrival. */
export function isLeftChanges(record: SwitchShelveRecord): record is LeftChangesRecord {
  return record.reason !== 'shelve';
}

/**
 * The record as its changes wait on `spec`, if they do. Left changes wait where they were made. Changes being brought
 * wait on the target until their conflicts are resolved, and where they were made too, as left there: the user went
 * back instead.
 */
export function waitingOn(record: SwitchShelveRecord, spec: string): LeftChangesRecord | undefined {
  if (!isLeftChanges(record)) return undefined;
  if (record.source.spec === spec) return { ...record, mode: 'leave' };
  return record.mode === 'bring' && record.target.spec === spec ? record : undefined;
}

/** How "Welcome back" offers the changes of one of this app's records. */
export function toLeftChanges(record: LeftChangesRecord): LeftChanges {
  return {
    shelveId: record.shelveId,
    sourceName: record.source.name,
    targetName: record.target.name || undefined,
    mode: record.mode,
    reason: record.reason ?? 'switch',
    count: record.paths.length,
    createdAt: record.createdAt,
    foreign: false,
  };
}
