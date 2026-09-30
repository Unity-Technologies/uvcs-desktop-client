import { Calendar, GitCommitVertical, User } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { ItemRevision } from '@shared/domain/history';
import { navigation } from '../../app/navigation/navigationStore';
import { useOtherRepository } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { PaneToolbar, PaneToolbarGroup } from '../../ui/PaneToolbar';
import { CenteredSpinner } from '../../ui/Spinner';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { AgeLegend } from './AgeLegend';
import { AnnotatedCode } from './AnnotatedCode';
import { useAnnotateOptions, type AnnotateColumns } from './annotateOptionsStore';
import { annotationBlocks, distinctAuthors } from './annotationBlocks';
import type { BlockLinks } from './blockLinks';
import { revisionBefore } from './revisionBefore';
import { useFileAnnotation } from './useFileAnnotation';
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
  /** The repository the file lives in, whose changesets its lines name: the workspace's, or under an xlink the xlinked one. */
  repository: string;
  /** Revision to annotate; the one loaded in the workspace when omitted. */
  revision?: ItemRevision;
  /** Shown first in the toolbar, e.g. a view switch. */
  leading?: ReactNode;
  /**
   * Beside a history list, blocks lead to their revisions there, and each change walks back to the revision before
   * it. Without one, "Show in history" opens the file's history.
   */
  history?: AnnotationHistory;
}

/** The gutter's details the toolbar shows or hides. */
const COLUMN_TOGGLES: { column: keyof AnnotateColumns; icon: ReactNode; label: string }[] = [
  { column: 'author', icon: <User size={14} />, label: 'Show authors' },
  { column: 'changeset', icon: <GitCommitVertical size={14} />, label: 'Show changesets' },
  { column: 'date', icon: <Calendar size={14} />, label: 'Show dates' },
];

/** Who last changed each line of a file, with a toolbar to pick the details and walk back through older revisions. */
export function AnnotationPane({ path, repository, revision, leading, history }: AnnotationPaneProps) {
  const otherRepository = useOtherRepository(repository);
  const { columns, toggleColumn } = useAnnotateOptions();
  // By revision id: the path spec finds nothing in the changesets before the file moved.
  const spec = revision?.idSpec;
  const { data: annotation, error } = useFileAnnotation(path, spec);

  const blocks = useMemo(() => (annotation ? annotationBlocks(annotation) : []), [annotation]);
  const code = useMemo(() => annotation?.lines.map((line) => line.content).join('\n') ?? '', [annotation]);
  const links = useMemo<BlockLinks>(
    () => ({
      openChangeset: otherRepository ? undefined : (id) => openChangesetDiff({ id }, path),
      showInHistory: history?.select ?? ((id) => navigation.openPage({ kind: 'history', path, select: { changesetId: id } })),
      selectsInHistory: history !== undefined,
      walkBack: history && { revisionBefore: (id) => revisionBefore(history.revisions, id), annotateBefore: history.annotate },
    }),
    [path, history, otherRepository],
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
          {COLUMN_TOGGLES.map(({ column, icon, label }) => (
            <IconButton key={column} size="small" icon={icon} label={label} variant={columns[column] ? 'secondary' : 'ghost'} onClick={() => toggleColumn(column)} />
          ))}
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
