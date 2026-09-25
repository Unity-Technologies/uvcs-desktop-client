import type { ContentSource } from '@shared/domain/content';
import type { DiffEntry } from '@shared/domain/diff';
import { PathLabel } from '../../components/PathLabel';
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
      title={<PathLabel path={file.path} oldPath={file.oldPath} />}
    />
  );
}
