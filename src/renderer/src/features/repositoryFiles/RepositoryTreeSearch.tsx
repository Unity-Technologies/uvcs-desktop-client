import { GoToFileList } from '../../components/GoToFileList';
import { ItemPathRow } from '../../components/ItemPathRow';
import { fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import { SearchField } from '../../ui/SearchField';
import { GO_TO_FILE_SHORTCUT } from '../files/useFileCommands';
import type { RepositoryTreeSearch } from './useRepositoryTreeSearch';
import styles from './RepositoryTreeSearch.module.css';

/** The field of a repository tree's search (`useRepositoryTreeSearch`), for the filter bar. */
export function RepositoryTreeSearchField({ search }: { search: RepositoryTreeSearch }) {
  return (
    <SearchField
      ref={search.inputRef}
      value={search.query}
      onChange={search.setQuery}
      onKeyDown={search.onKeyDown}
      placeholder="Find files and folders by name"
      tip={{ text: 'Go to file', shortcut: GO_TO_FILE_SHORTCUT }}
      width={280}
    />
  );
}

/** What a repository tree's search found, shown in the tree's place while the user types. */
export function RepositoryTreeSearchResults({ search }: { search: RepositoryTreeSearch }) {
  const { view, query } = search;
  const directories = new Set(view.paths.flatMap((found) => (found.isDirectory ? [found.path] : [])));
  return (
    <div className={styles.results}>
      <GoToFileList
        paths={view.paths.map((found) => found.path)}
        highlighted={search.highlighted}
        onHighlight={search.setHighlighted}
        onPick={search.pick}
        loading={view.loading}
        note={view.note}
        row={(path) => (
          <ItemPathRow path={path} itemType={directories.has(path) ? 'directory' : 'file'} matches={fuzzyMatchPositions(path, query)} />
        )}
      />
    </div>
  );
}
