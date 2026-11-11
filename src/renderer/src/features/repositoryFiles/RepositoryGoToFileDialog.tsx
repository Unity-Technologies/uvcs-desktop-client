import { useState, type KeyboardEvent } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { goToFileKey } from '../../components/goToFileKeys';
import { GoToFileList } from '../../components/GoToFileList';
import { ItemPathRow } from '../../components/ItemPathRow';
import { fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { SearchField } from '../../ui/SearchField';
import { goToFileWording, type GoToFileScope } from './goToFileScope';
import { repositoryFileSearchView } from './repositoryFileSearch';
import { useRepositoryFileSearch } from './useRepositoryFileSearch';

interface RepositoryGoToFileOptions {
  place: RepositoryPlace;
  /** The changeset whose tree is searched: the latest of the branch Files shows, or the one Browse repository shows. */
  changesetId: number;
  /** What the dialog says it searches. */
  scope: GoToFileScope;
}

/**
 * Finds a file or folder of a repository explored without a workspace by name, as Go to file finds a workspace's
 * (docs/features/explore-repository.md, "Finding a file"). Resolves the path picked, for the tree to reveal.
 */
export function goToRepositoryFile(options: RepositoryGoToFileOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <RepositoryGoToFileDialog {...options} finish={finish} />);
}

function RepositoryGoToFileDialog({ place, changesetId, scope, finish }: RepositoryGoToFileOptions & { finish: (path: string | undefined) => void }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const wording = goToFileWording(scope);
  const { paths, loading, note } = repositoryFileSearchView(useRepositoryFileSearch(place, changesetId, query), query, wording.name);
  const directories = new Set(paths.flatMap((found) => (found.isDirectory ? [found.path] : [])));

  const onKeyDown = (event: KeyboardEvent): void => {
    const key = goToFileKey(event.key, highlighted, paths.length);
    if (!key) return;
    event.preventDefault();
    if (key.kind === 'highlight') setHighlighted(key.index);
    else finish(paths[key.index]!.path);
  };

  return (
    <Dialog title="Go to file" description={wording.description} width={620} onClose={() => finish(undefined)}>
      <div onKeyDown={onKeyDown}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setHighlighted(0);
          }}
          placeholder="Find files and folders by name"
          autoFocus
          width={570}
        />
      </div>
      <GoToFileList
        paths={paths.map((found) => found.path)}
        highlighted={highlighted}
        onHighlight={setHighlighted}
        onPick={finish}
        loading={loading}
        note={note}
        row={(path) => <ItemPathRow path={path} itemType={directories.has(path) ? 'directory' : 'file'} matches={fuzzyMatchPositions(path, query)} />}
      />
    </Dialog>
  );
}
