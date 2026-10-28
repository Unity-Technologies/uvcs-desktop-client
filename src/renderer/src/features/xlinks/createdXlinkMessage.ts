import type { CreatedXlink } from '@shared/domain/xlinks';
import type { OperationSuccess } from '../../app/operations/runOperation';

/**
 * How creating the xlink at `path` ends: created, checked in and its files showing; or, when a step after creating it
 * failed, what it is now and what's left to do. Never an error: the xlink exists either way.
 */
export function createdXlinkMessage(path: string, created: CreatedXlink): OperationSuccess {
  const title = `Created xlink ${path}`;
  switch (created.kind) {
    case 'loaded':
      if (created.changesWaitIn === undefined) return { title, detail: `Checked in as changeset ${created.changesetId}.` };
      return { kind: 'info', title, detail: `Checked in as changeset ${created.changesetId}. Your other changes didn’t come back on their own: Changes offers them back.` };
    case 'notCheckedIn':
      return { kind: 'info', title: `${title}, not checked in`, detail: `${created.reason}. Check it in from Changes to see its files.` };
    case 'notLoaded':
      return { kind: 'info', title, detail: `Checked in as changeset ${created.changesetId}, but its files didn’t load: ${created.reason}.` };
  }
}
