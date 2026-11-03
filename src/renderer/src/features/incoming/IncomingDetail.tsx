import { workspacePlace } from '@shared/domain/place';
import type { DiffEntry } from '@shared/domain/diff';
import type { ReactNode } from 'react';
import { diffEntrySources, diffEntryStatus } from '../diff/diffEntrySources';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';

/**
 * What an incoming change does to a file: the loaded version against the branch head. `compareControls` holds the
 * `.meta` toggle of a Unity asset listed with its meta (`MetaDiffButton`).
 */
export function IncomingFileDiff({ workspacePath, file, compareControls }: { workspacePath: string; file: DiffEntry; compareControls?: ReactNode }) {
  const { original, modified } = diffEntrySources(file);

  return (
    <FileDiffViewer
      place={workspacePlace(workspacePath)}
      original={original}
      modified={modified}
      fileName={file.path}
      compareControls={compareControls}
      title={<DiffFileTitle status={diffEntryStatus(file)} path={file.path} oldPath={file.oldPath} />}
    />
  );
}
