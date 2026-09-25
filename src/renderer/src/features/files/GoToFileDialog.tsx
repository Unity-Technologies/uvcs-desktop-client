import { useQuery } from '@tanstack/react-query';
import { File, Folder } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { PathLabel } from '../../components/PathLabel';
import { Dialog } from '../../ui/dialog/Dialog';
import { askDialog } from '../../ui/dialog/dialogStore';
import { SearchField } from '../../ui/SearchField';
import { CenteredSpinner } from '../../ui/Spinner';
import { rankPaths } from './rankPaths';
import styles from './GoToFileDialog.module.css';

const MAX_RESULTS = 60;

/** Asks for a file or folder by (fuzzy) name. Resolves to its path, or undefined if dismissed. */
export function goToFile(workspacePath: string): Promise<string | undefined> {
  return askDialog<string>((finish) => <GoToFileDialog workspacePath={workspacePath} finish={finish} />);
}

function GoToFileDialog({ workspacePath, finish }: { workspacePath: string; finish: (path: string | undefined) => void }) {
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const { data: entries, isLoading } = useQuery({
    queryKey: queryKeys.inWorkspace(workspacePath, 'explorer', 'allPaths'),
    queryFn: () => api.explorer.listAllPaths(workspacePath),
    staleTime: 60_000,
  });

  const directories = useMemo(() => new Set(entries?.filter((entry) => entry.isDirectory).map((entry) => entry.path)), [entries]);
  const allPaths = useMemo(() => entries?.map((entry) => entry.path) ?? [], [entries]);
  const results = useMemo(() => rankPaths(allPaths, query, MAX_RESULTS), [allPaths, query]);

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setHighlighted((current) => Math.min(results.length - 1, Math.max(0, current + step)));
    } else if (event.key === 'Enter' && results[highlighted]) {
      event.preventDefault();
      finish(results[highlighted]);
    }
  };

  return (
    <Dialog title="Go to file" width={620} onClose={() => finish(undefined)}>
      <div onKeyDown={onKeyDown}>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setHighlighted(0);
          }}
          placeholder="Type part of a file or folder name"
          autoFocus
          width={570}
        />
      </div>
      <div className={styles.results}>
        {isLoading && <CenteredSpinner />}
        {!isLoading && results.length === 0 && <div className={styles.empty}>No files match “{query}”.</div>}
        {results.map((path, index) => (
          <button
            key={path}
            type="button"
            className={styles.result}
            data-highlighted={index === highlighted}
            onMouseEnter={() => setHighlighted(index)}
            onClick={() => finish(path)}
          >
            {directories.has(path) ? <Folder size={14} className={styles.folder} /> : <File size={14} className={styles.file} />}
            <PathLabel path={path} />
          </button>
        ))}
      </div>
    </Dialog>
  );
}
