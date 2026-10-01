import type { DiffEntry } from '@shared/domain/diff';
import { diffEntrySources, diffEntryStatus } from '../diff/diffEntrySources';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';

/** What an incoming change does to a file: the loaded version against the branch head. */
export function IncomingFileDiff({ workspacePath, file }: { workspacePath: string; file: DiffEntry }) {
  const { original, modified } = diffEntrySources(file);

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={original}
      modified={modified}
      fileName={file.path}
      title={<DiffFileTitle status={diffEntryStatus(file)} path={file.path} oldPath={file.oldPath} />}
    />
  );
}
