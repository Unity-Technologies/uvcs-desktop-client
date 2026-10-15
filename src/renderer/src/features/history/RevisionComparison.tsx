import { useMemo, type ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { ItemRevision } from '@shared/domain/history';
import { revisionRef } from '@shared/domain/revision';
import { AssetsPointContext, inWorkspaceRepository, revisionsAssetsPoint } from '../diff/viewer/model/assetsPoints';
import { historySibling, SiblingFinderContext } from '../diff/viewer/model/modelSiblings';
import { useWorkspaceInfo, useWorkspacePath } from '../../app/workspace/useWorkspace';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import styles from './RevisionComparison.module.css';

interface RevisionComparisonProps {
  path: string;
  newer: ItemRevision;
  /** None when `newer` created the file. */
  older: ItemRevision | undefined;
  /** The last changeset that moved, renamed or removed the file: before it, nothing beside it is looked for. */
  lastPathChange: number | null;
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
}

/** The diff between two revisions of a file. */
export function RevisionComparison({ path, newer, older, lastPathChange, leading }: RevisionComparisonProps) {
  const workspacePath = useWorkspacePath();
  const inWorkspace = inWorkspaceRepository(newer.repository, useWorkspaceInfo().data?.repository);
  const { findAssetsPoint, findSibling } = useMemo(() => {
    const points = { changesets: { original: older?.changesetId ?? null, modified: newer.changesetId }, inWorkspaceRepository: inWorkspace, lastPathChange };
    return { findAssetsPoint: revisionsAssetsPoint(points), findSibling: historySibling(points) };
  }, [older?.changesetId, newer.changesetId, inWorkspace, lastPathChange]);

  return (
    <AssetsPointContext.Provider value={findAssetsPoint}>
      <SiblingFinderContext.Provider value={findSibling}>
        <FileDiffViewer
          workspacePath={workspacePath}
          original={older ? revisionSource(older, path) : { kind: 'empty' }}
          modified={revisionSource(newer, path)}
          fileName={path}
          title={
            <>
              {leading}
              <span className={styles.title}>
                {older ? `cs:${older.changesetId} → ` : 'Created in '}
                <strong>cs:{newer.changesetId}</strong>
              </span>
            </>
          }
        />
      </SiblingFinderContext.Provider>
    </AssetsPointContext.Provider>
  );
}

function revisionSource(revision: ItemRevision, path: string): ContentSource {
  return { kind: 'revision', revision: revisionRef(revision), fileName: path };
}
