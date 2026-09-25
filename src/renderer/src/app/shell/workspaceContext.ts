import type { IncomingSummary } from '@shared/domain/incoming';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';

export interface WorkspaceContext {
  /** Where the workspace is, e.g. "cs:11 on /main". */
  position: string;
  /** How it compares to its branch: "up to date", "3 behind"; null while unknown or off a branch. */
  sync: string | null;
  behind: number;
}

/** A one-line account of what the workspace has loaded and whether its branch moved on. */
export function workspaceContext(info: WorkspaceInfo, summary: IncomingSummary | undefined): WorkspaceContext {
  const changeset = `cs:${info.loadedChangeset}`;
  if (info.selector.kind !== 'branch') {
    const name = workingObjectName(info.selector);
    const position = name === changeset ? changeset : `${changeset} · ${SELECTOR_KIND_LABELS[info.selector.kind]} ${name}`;
    return { position, sync: null, behind: 0 };
  }

  const position = `${changeset} on ${info.selector.name}`;
  if (!summary || summary.branch !== info.selector.name) return { position, sync: null, behind: 0 };
  const behind = summary.changesetCount;
  return { position, sync: behind === 0 ? 'up to date' : `${behind} behind`, behind };
}
