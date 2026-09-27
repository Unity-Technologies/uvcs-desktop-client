import { useQuery } from '@tanstack/react-query';
import { Calendar, GitCommitVertical, User } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { isPinnedSpec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { PaneToolbar, PaneToolbarGroup } from '../../ui/PaneToolbar';
import { CenteredSpinner } from '../../ui/Spinner';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { AgeLegend } from './AgeLegend';
import { AnnotatedCode, type BlockLinks } from './AnnotatedCode';
import { useAnnotateOptions } from './annotateOptionsStore';
import { annotationBlocks, distinctAuthors } from './annotationBlocks';
import { revisionBefore } from './revisionBefore';
import styles from './AnnotationPane.module.css';

/** The history list an annotation sits beside, which then says which revision is annotated. */
export interface AnnotationHistory {
  /** The file's history, newest first. Lets each change be walked back to the file as it was before it. */
  revisions: ItemRevision[];
  /** Selects the revision a block's changeset made: clicking the block, Enter, "Show in history". */
  select: (changesetId: number) => void;
  /** Selects the revision to annotate "before this change". */
  annotate: (revision: ItemRevision) => void;
}

interface AnnotationPaneProps {
  path: string;
  /** Revision to annotate; the one loaded in the workspace when omitted. */
  revision?: ItemRevision;
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
  /**
   * Beside a history list, blocks lead to their revisions there, and each change walks back to the revision before
   * it. Without one, "Show in history" opens the file's history.
   */
  history?: AnnotationHistory;
  /** Where the path is read (browsing a changeset), for the history "Show in history" opens. */
  changesetId?: number;
}

/** Who last changed each line of a file, with a toolbar to pick the details and walk back through older revisions. */
export function AnnotationPane({ path, revision, leading, history, changesetId }: AnnotationPaneProps) {
  const workspacePath = useWorkspacePath();
  const { columns, toggleColumn } = useAnnotateOptions();
  // By revision id: the path spec finds nothing in the changesets before the file moved.
  const spec = revision?.idSpec;

  const { data: annotation, error } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'annotate', path, spec),
    queryFn: () => api.annotate.file(workspacePath, path, spec),
    // A revision pinned to a changeset is annotated once; the workspace's own version follows local edits.
    ...(spec !== undefined && isPinnedSpec(spec) ? { staleTime: Infinity, meta: IMMUTABLE_QUERY } : {}),
  });

  const blocks = useMemo(() => (annotation ? annotationBlocks(annotation) : []), [annotation]);
  const code = useMemo(() => annotation?.lines.map((line) => line.content).join('\n') ?? '', [annotation]);
  const links = useMemo<BlockLinks>(
    () => ({
      openChangeset: (id) => openChangesetDiff({ id }, path),
      showInHistory: history?.select ?? ((id) => navigation.openPage({ kind: 'history', path, changesetId, select: { changesetId: id } })),
      selectsInHistory: history !== undefined,
      walkBack: history && { revisionBefore: (id) => revisionBefore(history.revisions, id), annotateBefore: history.annotate },
    }),
    [path, history, changesetId],
  );

  const revisionLabel = revision && `cs:${revision.changesetId}`;

  return (
    <div className={styles.pane}>
      <PaneToolbar
        title={
          <>
            {leading}
            <span className={styles.caption}>
              {revisionLabel && <strong>{revisionLabel}</strong>}
              {revisionLabel && annotation && ' · '}
              {annotation && `${pluralize(annotation.lines.length, 'line')} · ${pluralize(distinctAuthors(annotation), 'author')}`}
            </span>
          </>
        }
      >
        <AgeLegend />
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
        <AnnotatedCode key={spec} code={code} path={path} blocks={blocks} lineCount={annotation.lines.length} columns={columns} links={links} />
      )}
    </div>
  );
}
