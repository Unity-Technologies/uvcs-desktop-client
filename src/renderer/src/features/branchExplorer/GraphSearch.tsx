import { ChevronDown, ChevronUp } from 'lucide-react';
import { IconButton } from '../../ui/IconButton';
import { SearchField } from '../../ui/SearchField';
import styles from './BranchExplorerView.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

interface GraphSearchProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Null while there is no search; `current` is 0 before stepping through the matches. */
  position: { current: number; total: number } | null;
  onStep: (direction: 1 | -1) => void;
}

/** Finds changesets by number, comment or author, and branches and labels by name; Enter steps through the matches. */
export function GraphSearch({ search, onSearchChange, position, onStep }: GraphSearchProps) {
  return (
    <div
      className={styles.search}
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        onStep(event.shiftKey ? -1 : 1);
      }}
    >
      {position && (
        <>
          <span className={styles.searchCount}>{describePosition(position)}</span>
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous match" shortcut={hotkey('graphPreviousMatch')} onClick={() => onStep(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next match" shortcut={hotkey('graphNextMatch')} onClick={() => onStep(1)} />
        </>
      )}
      <SearchField value={search} onChange={onSearchChange} placeholder="Find in graph…" width={220} />
    </div>
  );
}

function describePosition({ current, total }: { current: number; total: number }): string {
  if (total === 0) return 'No matches';
  if (current === 0) return total === 1 ? '1 match' : `${total} matches`;
  return `${current} of ${total}`;
}
