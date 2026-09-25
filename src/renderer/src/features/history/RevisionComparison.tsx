import type { ReactNode } from 'react';
import type { ContentSource } from '@shared/domain/content';
import type { ItemRevision } from '@shared/domain/history';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
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
  const workspacePath = useWorkspacePath();

  return (
    <FileDiffViewer
      workspacePath={workspacePath}
      original={older ? revisionSource(older, path) : { kind: 'empty' }}
      modified={revisionSource(newer, path)}
      fileName={path}
      title={
        <>
          {leading}
          <span className={styles.title}>
            {older ? `cs:${older.changesetId}` : 'Created in'} → <strong>cs:{newer.changesetId}</strong>
          </span>
        </>
      }
    />
  );
}

function revisionSource(revision: ItemRevision, path: string): ContentSource {
  return { kind: 'revision', revisionId: revision.revisionId, fileName: path };
}
