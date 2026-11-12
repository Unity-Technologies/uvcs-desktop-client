import { GoToFileList } from '../../components/GoToFileList';
import { ItemPathRow } from '../../components/ItemPathRow';
import type { RepositoryFileSearchView } from './repositoryFileSearch';

interface RepositoryFileSearchListProps {
  view: RepositoryFileSearchView;
  highlighted: number;
  onHighlight: (index: number) => void;
  onPick: (path: string) => void;
}

/** What a search of a repository's whole tree found (`repositoryFileSearchView`): Files, Browse repository and Choose what to download. */
export function RepositoryFileSearchList({ view, highlighted, onHighlight, onPick }: RepositoryFileSearchListProps) {
  const rows = new Map(view.rows.map((row) => [row.path, row]));
  return (
    <GoToFileList
      paths={view.rows.map((row) => row.path)}
      highlighted={highlighted}
      onHighlight={onHighlight}
      onPick={onPick}
      loading={view.loading}
      note={view.note}
      row={(path) => <ItemPathRow path={path} itemType={rows.get(path)!.itemType} matches={rows.get(path)!.matches} />}
    />
  );
}
