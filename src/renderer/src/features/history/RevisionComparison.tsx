import { useMemo, type ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { ItemRevision } from '@shared/domain/history';
import { revisionRef } from '@shared/domain/revision';
import { inWorkspaceRepository } from '@shared/domain/repository';
import { AssetsPointContext, revisionsAssetsPoint } from '../diff/viewer/model/assetsPoints';
import { historySibling, SiblingFinderContext } from '../diff/viewer/model/modelSiblings';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';
import { FileDiffViewer } from '../diff/viewer/FileDiffViewer';
import styles from './RevisionComparison.module.css';

interface RevisionComparisonProps {
  path: string;
  newer: ItemRevision;
  /** None when `newer` created the file. */
  older: ItemRevision | undefined;
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
}

/** The diff between two revisions of a file. */
export function RevisionComparison({ path, newer, older, leading }: RevisionComparisonProps) {
  const place = usePlace();
  const inWorkspace = inWorkspaceRepository(newer.repository, usePlaceRepository());
  const { findAssetsPoint, findSibling } = useMemo(() => {
    const points = { changesets: { original: older?.changesetId ?? null, modified: newer.changesetId }, inWorkspaceRepository: inWorkspace };
    return { findAssetsPoint: revisionsAssetsPoint(points), findSibling: historySibling(points) };
  }, [older?.changesetId, newer.changesetId, inWorkspace]);

  return (
    <AssetsPointContext.Provider value={findAssetsPoint}>
      <SiblingFinderContext.Provider value={findSibling}>
        <FileDiffViewer
          place={place}
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
