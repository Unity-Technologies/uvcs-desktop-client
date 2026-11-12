import { SearchField } from '../../ui/SearchField';
import { GO_TO_FILE_SHORTCUT } from '../files/useFileCommands';
import { RepositoryFileSearchList } from './RepositoryFileSearchList';
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
      disabled={!search.enabled}
      aria-label="Find files and folders by name"
      aria-controls={search.searching ? search.resultsId : undefined}
      placeholder="Find files and folders by name"
      tip={{ text: 'Go to file', shortcut: GO_TO_FILE_SHORTCUT }}
      width={280}
    />
  );
}

/** What a repository tree's search found, shown in the tree's place while the user types. */
export function RepositoryTreeSearchResults({ search }: { search: RepositoryTreeSearch }) {
  return (
    <div id={search.resultsId} className={styles.results}>
      <RepositoryFileSearchList view={search.view} highlighted={search.highlighted} onHighlight={search.setHighlighted} onPick={search.pick} />
    </div>
  );
}
