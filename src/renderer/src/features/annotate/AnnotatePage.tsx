import { useQuery } from '@tanstack/react-query';
import { Calendar, GitCommitVertical, History, User } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps } from '../../app/navigation/pages';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { pluralize } from '../../lib/text';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { CenteredSpinner } from '../../ui/Spinner';
import { ViewHeader } from '../../ui/ViewHeader';
import { openChangesetDiff } from '../changesets/changesetOperations';
import { AnnotatedCode } from './AnnotatedCode';
import { useAnnotateOptions } from './annotateOptionsStore';
import { buildAnnotationRows, distinctAuthors } from './annotationRows';
import styles from './AnnotatePage.module.css';

export function AnnotatePage({ page }: PageProps<'annotate'>) {
  const workspacePath = useWorkspacePath();
  const { columns, toggleColumn } = useAnnotateOptions();
  const { data: annotation, error } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'annotate', page.path, page.revisionSpec),
    queryFn: () => api.annotate.file(workspacePath, page.path, page.revisionSpec),
  });

  const rows = useMemo(() => (annotation ? buildAnnotationRows(annotation) : []), [annotation]);
  const code = useMemo(() => annotation?.lines.map((line) => line.content).join('\n') ?? '', [annotation]);
  const openChangeset = useCallback((changesetId: number) => openChangesetDiff({ id: changesetId }, page.path), [page.path]);

  const header = (
    <ViewHeader
      title={page.path}
      subtitle={
        annotation &&
        `${page.revisionSpec ? `at ${page.revisionSpec.split('#').at(-1)} · ` : ''}${pluralize(annotation.lines.length, 'line')} · ${pluralize(distinctAuthors(annotation), 'author')}`
      }
      actions={
        <>
          <div className={styles.legend} title="Older lines have a lighter strip">
            <span>Older</span>
            <span className={styles.scale} />
            <span>Newer</span>
          </div>
          <IconButton icon={<User size={14} />} label="Show authors" variant={columns.author ? 'secondary' : 'ghost'} onClick={() => toggleColumn('author')} />
          <IconButton
            icon={<GitCommitVertical size={14} />}
            label="Show changesets"
            variant={columns.changeset ? 'secondary' : 'ghost'}
            onClick={() => toggleColumn('changeset')}
          />
          <IconButton icon={<Calendar size={14} />} label="Show dates" variant={columns.date ? 'secondary' : 'ghost'} onClick={() => toggleColumn('date')} />
          <IconButton icon={<History size={14} />} label="View history" onClick={() => navigation.openPage({ kind: 'history', path: page.path })} />
        </>
      }
    />
  );

  if (error) return <>{header}<EmptyState title="Couldn't annotate this file" description={error.message} /></>;
  if (!annotation) return <>{header}<CenteredSpinner /></>;

  return (
    <>
      {header}
      <AnnotatedCode code={code} path={page.path}rows={rows} columns={columns} onOpenChangeset={openChangeset} />
    </>
  );
}
