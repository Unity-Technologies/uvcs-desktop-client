import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { describeDiffEntry, diffEntryTone } from '../diff/diffEntrySources';
import { DiffFileTitle } from '../diff/viewer/DiffFileTitle';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';

/** What an incoming change does to a file: the loaded version against the branch head. */
export function IncomingFileDiff({ workspacePath, file }: { workspacePath: string; file: DiffEntry }) {
  const version = (revisionId: number): ContentSource =>
    revisionId < 0 ? { kind: 'empty' } : { kind: 'revision', revisionId, fileName: file.path };

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={version(file.baseRevisionId)}
      modified={version(file.revisionId)}
      fileName={file.path}
      title={<DiffFileTitle tone={diffEntryTone(file)} status={describeDiffEntry(file)} path={file.path} oldPath={file.oldPath} />}
    />
  );
}
