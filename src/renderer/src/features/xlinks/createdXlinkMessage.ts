import type { CreatedXlink, LoadedXlinkFiles } from '@shared/domain/xlinks';
import type { OperationSuccess } from '../../app/operations/runOperation';

// Files offers it once it has listed the xlink's empty folder (`unloadedXlinkOf`): opened, not only selected.
const LOAD_LATER = 'open its folder in Files and choose Load its files on it';
const CHANGES_WAITING = 'Your other changes didn’t come back on their own: Changes offers them back.';

/**
 * How creating the xlink at `path` ends: created, checked in and its files showing; or, when a step after creating it
 * failed, what it is now and what's left to do, naming only what the app offers (`loadAgain`: "Load its files").
 * Never an error: the xlink exists either way.
 */
export function createdXlinkMessage(path: string, created: CreatedXlink, loadAgain: () => void): OperationSuccess {
  const title = `Created xlink ${path}`;
  const checkedIn = (changesetId: number) => `Checked in as changeset ${changesetId}`;
  switch (created.kind) {
    case 'loaded':
      if (created.changesWaitIn === undefined) return { title, detail: `${checkedIn(created.changesetId)}.` };
      return { kind: 'info', title, detail: `${checkedIn(created.changesetId)}. ${CHANGES_WAITING}` };
    case 'notCheckedIn':
      return { kind: 'info', title: `${title}, not checked in`, detail: `${created.reason}. To see its files, check it in from Changes, then ${LOAD_LATER}.` };
    case 'notLoaded':
      return {
        kind: 'info',
        title,
        detail: `${checkedIn(created.changesetId)}, but its files didn’t load: ${created.reason}. To try again, ${LOAD_LATER}.`,
        action: { label: 'Load its files', run: loadAgain },
      };
  }
}

/** How loading the files of the xlink at `path` ends (`XlinksApi.load`). */
export function loadedXlinkMessage(path: string, loaded: LoadedXlinkFiles): OperationSuccess {
  const title = `Loaded the files of xlink ${path}`;
  return loaded.changesWaitIn === undefined ? { title } : { kind: 'info', title, detail: CHANGES_WAITING };
}
