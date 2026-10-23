import { useState, type KeyboardEvent } from 'react';
import type { RepositoryPlace } from '@shared/domain/place';
import { ItemPathRow } from '../../components/ItemPathRow';
import { fuzzyMatchPositions } from '../../lib/fuzzyIndex';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import styles from '../files/GoToFileDialog.module.css';
import { repositoryFileSearchNote } from './repositoryFileSearch';
import { useRepositoryFileSearch } from './useRepositoryFileSearch';

interface RepositoryGoToFileOptions {
  place: RepositoryPlace;
  /** The changeset whose tree is searched: the latest of the branch Files shows. */
  changesetId: number;
  /** The branch, as the dialog names it. */
  branch: string;
}

/**
 * Finds a file or folder of a repository explored without a workspace by name, as Go to file finds a workspace's
 * (docs/features/explore-repository.md, "Finding a file"). Resolves the path picked, for Files to reveal.
 */
export function goToRepositoryFile(options: RepositoryGoToFileOptions): Promise<string | undefined> {
  return askDialog<string>((finish) => <RepositoryGoToFileDialog {...options} finish={finish} />);
}

function RepositoryGoToFileDialog({ place, changesetId, branch, finish }: RepositoryGoToFileOptions & { finish: (path: string | undefined) => void }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const search = useRepositoryFileSearch(place, changesetId, query);
  const results = search.kind === 'searching' || search.kind === 'found' ? search.paths : [];
  const note = repositoryFileSearchNote(search, query, branch);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => Math.min(results.length - 1, Math.max(0, current + step)));
    } else if (event.key === 'Enter' && results[highlighted]) {
      event.preventDefault();
      finish(results[highlighted]!.path);
    }
  };

  return (
    <Dialog title="Go to file" description={`In the latest of ${branch}`} width={620} onClose={() => finish(undefined)}>
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
      <div className={styles.results}>
        {search.kind === 'searching' && results.length === 0 && <CenteredSpinner />}
        {note && <div className={styles.empty}>{note}</div>}
        {results.map(({ path, isDirectory }, index) => (
          <div key={path} className={styles.resultRow} data-highlighted={index === highlighted} onMouseEnter={() => setHighlighted(index)}>
            <button type="button" className={styles.result} onClick={() => finish(path)}>
              <ItemPathRow path={path} itemType={isDirectory ? 'directory' : 'file'} matches={fuzzyMatchPositions(path, query)} />
            </button>
          </div>
        ))}
      </div>
    </Dialog>
  );
}
