import { History } from 'lucide-react';
import { navigation } from '../../app/navigation/navigationStore';
import type { PageProps } from '../../app/navigation/pages';
import { IconButton } from '../../ui/IconButton';
import { ViewHeader } from '../../ui/ViewHeader';
import { useItemHistory } from '../history/useItemHistory';
import { AnnotationPane } from './AnnotationPane';

export function AnnotatePage({ page }: PageProps<'annotate'>) {
  const { data: history } = useItemHistory(page.path, page.changesetId);

  return (
    <>
      <ViewHeader
        title={page.path}
        actions={<IconButton icon={<History size={14} />} label="View history" onClick={() => navigation.openPage({ kind: 'history', path: page.path, changesetId: page.changesetId })} />}
      />
      <AnnotationPane key={page.revision?.idSpec} path={page.path} revision={page.revision} revisions={history?.revisions} />
    </>
  );
}
