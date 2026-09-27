import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, GitCommitVertical, User } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { isPinnedSpec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { PaneToolbar, PaneToolbarGroup } from '../../ui/PaneToolbar';
import { CenteredSpinner } from '../../ui/Spinner';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { AnnotatedCode } from './AnnotatedCode';
import type { AnnotateBefore } from './AnnotationGutter';
import { useAnnotateOptions } from './annotateOptionsStore';
import { buildAnnotationRows, distinctAuthors } from './annotationRows';
import { revisionBefore } from './revisionBefore';
import styles from './AnnotationPane.module.css';

interface AnnotationPaneProps {
  path: string;
  /** Revision to annotate; the one loaded in the workspace when omitted. */
  revision?: ItemRevision;
  /** The file's history, newest first. Lets each change be walked back to the file as it was before it. */
  revisions?: ItemRevision[];
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
}

/** Who last changed each line of a file, with a toolbar to pick the details and walk back through older revisions. */
export function AnnotationPane({ path, revision, revisions, leading }: AnnotationPaneProps) {
  const workspacePath = useWorkspacePath();
  const { columns, toggleColumn } = useAnnotateOptions();
  // Revisions reached with "Annotate before this change"; Back returns to the previous one.
  const [trail, setTrail] = useState<ItemRevision[]>([]);
  const walkedTo = trail.at(-1);
  const shown = walkedTo ?? revision;
  // By revision id: the path spec finds nothing in the changesets before the file moved.
  const spec = shown?.idSpec;

  const { data: annotation, error } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'annotate', path, spec),
    queryFn: () => api.annotate.file(workspacePath, path, spec),
    // A revision pinned to a changeset is annotated once; the workspace's own version follows local edits.
    ...(spec !== undefined && isPinnedSpec(spec) ? { staleTime: Infinity, meta: IMMUTABLE_QUERY } : {}),
  });

  const rows = useMemo(() => (annotation ? buildAnnotationRows(annotation) : []), [annotation]);
  const code = useMemo(() => annotation?.lines.map((line) => line.content).join('\n') ?? '', [annotation]);
  const openChangeset = useCallback((changesetId: number) => openChangesetDiff({ id: changesetId }, path), [path]);
  const annotateBefore = useMemo<AnnotateBefore | undefined>(
    () =>
      revisions && {
        revisionBefore: (changesetId) => revisionBefore(revisions, changesetId),
        annotate: (revision) => setTrail((current) => [...current, revision]),
      },
    [revisions],
  );

  const revisionLabel = shown && `cs:${shown.changesetId}`;

  return (
    <div className={styles.pane}>
      <PaneToolbar
        title={
          <>
            {leading}
            {walkedTo && (
              <Button size="small" variant="ghost" icon={<ArrowLeft size={13} />} onClick={() => setTrail((current) => current.slice(0, -1))}>
                Back
              </Button>
            )}
            <span className={styles.caption}>
              {revisionLabel && <strong>{revisionLabel}</strong>}
              {revisionLabel && annotation && ' · '}
              {annotation && `${pluralize(annotation.lines.length, 'line')} · ${pluralize(distinctAuthors(annotation), 'author')}`}
            </span>
          </>
        }
      >
        <div className={styles.legend} data-tip="Older lines have a lighter strip">
          <span>Older</span>
          <span className={styles.scale} />
          <span>Newer</span>
        </div>
        <PaneToolbarGroup>
          <IconButton size="small" icon={<User size={14} />} label="Show authors" variant={columns.author ? 'secondary' : 'ghost'} onClick={() => toggleColumn('author')} />
          <IconButton
            size="small"
            icon={<GitCommitVertical size={14} />}
            label="Show changesets"
            variant={columns.changeset ? 'secondary' : 'ghost'}
            onClick={() => toggleColumn('changeset')}
          />
          <IconButton size="small" icon={<Calendar size={14} />} label="Show dates" variant={columns.date ? 'secondary' : 'ghost'} onClick={() => toggleColumn('date')} />
        </PaneToolbarGroup>
      </PaneToolbar>

      {error ? (
        <EmptyState title="Couldn't annotate this file" description={error.message} />
      ) : !annotation ? (
        <CenteredSpinner />
      ) : (
        <AnnotatedCode code={code} path={path} rows={rows} columns={columns} onOpenChangeset={openChangeset} annotateBefore={annotateBefore} />
      )}
    </div>
  );
}
