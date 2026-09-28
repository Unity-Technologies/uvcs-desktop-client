import type { CheckinResult } from '@shared/domain/pendingChanges';

const CREATED_CHANGESET_LINE = /^CHANGESET cs:(\d+)@br:([^@]+)@/m;
/** `cm checkin --machinereadable` found nothing left to record (it prints the tag alone, in any language) and exited 0. */
const NO_CHANGES_LINE = /^NO_CHANGES_APPLIED$/m;

/** What a `cm checkin --machinereadable` that exited 0 did: the changeset it created, or none left to create. */
export function readCheckinOutput(output: string): CheckinResult {
  const created = CREATED_CHANGESET_LINE.exec(output);
  if (created) return { kind: 'created', changesetId: Number(created[1]), branch: created[2] };
  if (NO_CHANGES_LINE.test(output)) return { kind: 'noChanges' };
  throw new Error('The checkin finished but no changeset was reported.');
}
