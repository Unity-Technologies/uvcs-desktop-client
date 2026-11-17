import type { CreatedXlink, LoadedXlinkFiles } from '@shared/domain/xlinks';
import type { WorkspaceKind } from '@shared/domain/workspace';
import type { OperationSuccess } from '../../app/operations/runOperation';

// Files offers it once it has listed the xlink's empty folder (`unloadedXlinkOf`): opened, not only selected.
const LOAD_LATER = 'open its folder in Files and choose Load its files on it';
// A partial workspace refuses Load its files: it downloads an xlink whole, as a file (docs/features/partial-workspaces.md).
const CHOOSE_LATER = 'pick it in Choose what to download…';

/** The ways to an xlink's files the app offers after creating it: Load its files, or in a partial workspace Choose what to download…. */
export interface XlinkFilesWays {
  workspaceKind: WorkspaceKind | undefined;
  loadAgain: () => void;
  chooseDownloads: () => void;
}
const CHANGES_WAITING = 'Your other changes didn’t come back on their own: Changes offers them back.';

/**
 * How creating the xlink at `path` ends: created, checked in and its files showing; or, when a step after creating it
 * failed, what it is now and what's left to do, naming only what the app offers (`XlinkFilesWays`). Never an error:
 * the xlink exists either way. In a partial workspace its files never load as it's created (`loadXlink` refuses), so
 * the way to them is Choose what to download…, whatever the reason.
 */
export function createdXlinkMessage(path: string, created: CreatedXlink, ways: XlinkFilesWays): OperationSuccess {
  const title = `Created xlink ${path}`;
  const checkedIn = (changesetId: number) => `Checked in as changeset ${changesetId}`;
  switch (created.kind) {
    case 'loaded':
      if (created.changesWaitIn === undefined) return { title, detail: `${checkedIn(created.changesetId)}.` };
      return { kind: 'info', title, detail: `${checkedIn(created.changesetId)}. ${CHANGES_WAITING}` };
    case 'notCheckedIn': {
      const later = ways.workspaceKind === 'partial' ? CHOOSE_LATER : LOAD_LATER;
      return { kind: 'info', title: `${title}, not checked in`, detail: `${created.reason}. To see its files, check it in from Changes, then ${later}.` };
    }
    case 'notLoaded':
      if (ways.workspaceKind === 'partial') {
        return {
          kind: 'info',
          title,
          detail: `${checkedIn(created.changesetId)}. To download its files, ${CHOOSE_LATER}.`,
          action: { label: 'Choose what to download…', run: ways.chooseDownloads },
        };
      }
      return {
        kind: 'info',
        title,
        detail: `${checkedIn(created.changesetId)}, but its files didn’t load: ${created.reason}. To try again, ${LOAD_LATER}.`,
        action: { label: 'Load its files', run: ways.loadAgain },
      };
  }
}

/** How loading the files of the xlink at `path` ends (`XlinksApi.load`). */
export function loadedXlinkMessage(path: string, loaded: LoadedXlinkFiles): OperationSuccess {
  const title = `Loaded the files of xlink ${path}`;
  return loaded.changesWaitIn === undefined ? { title } : { kind: 'info', title, detail: CHANGES_WAITING };
}
