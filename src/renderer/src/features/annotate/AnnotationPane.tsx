import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, GitCommitVertical, User } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { isPinnedSpec } from '@shared/domain/specs';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import { IMMUTABLE_QUERY } from '../../app/queryClient';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { Button } from '../../ui/Button';
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
  /** Selects the revision a block's changeset made: clicking the block, Enter, "Show in history". */
  select: (changesetId: number) => void;
  /** Selects the revision to annotate "before this change". */
  annotate: (revision: ItemRevision) => void;
}

interface AnnotationPaneProps {
  path: string;
  /** Revision to annotate; the one loaded in the workspace when omitted. */
  revision?: ItemRevision;
  /** The file's history, newest first. Lets each change be walked back to the file as it was before it. */
  revisions?: ItemRevision[];
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
  /**
   * Beside a history list, blocks lead to their revisions there. Without one, "Show in history" opens the file's
   * history, and walking back stays in the pane, with Back.
   */
  history?: AnnotationHistory;
  /** Where the path is read (browsing a changeset), for the history "Show in history" opens. */
  changesetId?: number;
}

/** Who last changed each line of a file, with a toolbar to pick the details and walk back through older revisions. */
export function AnnotationPane({ path, revision, revisions, leading, history, changesetId }: AnnotationPaneProps) {
  const workspacePath = useWorkspacePath();
  const { columns, toggleColumn } = useAnnotateOptions();
  // Revisions reached with "Annotate before this change" without a history list; Back returns to the previous one.
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

  const blocks = useMemo(() => (annotation ? annotationBlocks(annotation) : []), [annotation]);
  const code = useMemo(() => annotation?.lines.map((line) => line.content).join('\n') ?? '', [annotation]);
  const links = useMemo<BlockLinks>(
    () => ({
      openChangeset: (id) => openChangesetDiff({ id }, path),
      showInHistory: history?.select ?? ((id) => navigation.openPage({ kind: 'history', path, changesetId, selectChangeset: id })),
      selectsInHistory: history !== undefined,
      revisionBefore: revisions && ((id) => revisionBefore(revisions, id)),
      annotateBefore: history?.annotate ?? ((before) => setTrail((current) => [...current, before])),
    }),
    [path, history, revisions, changesetId],
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
