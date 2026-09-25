import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useRef } from 'react';
import styles from './GraphSearch.module.css';

interface GraphSearchProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Null while there is no search; `current` is 0 before stepping through the matches. */
  position: { current: number; total: number } | null;
  onStep: (direction: 1 | -1) => void;
}

/**
 * Finds changesets by number, comment or author, and branches and labels by name. Like a find bar, the field holds
 * the match counter and the previous / next / clear buttons; Enter and Shift+Enter step, Escape clears.
 */
export function GraphSearch({ search, onSearchChange, position, onStep }: GraphSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const noMatches = position?.total === 0;
  const clear = (): void => {
    onSearchChange('');
    // Clearing restarts the search, it doesn't end it: the caret stays in the field.
    inputRef.current?.focus();
  };

  return (
    <div className={styles.field} data-active={position !== null} data-empty={noMatches}>
      <Search size={13} className={styles.icon} />
      <input
        ref={inputRef}
        className={styles.input}
        value={search}
        placeholder="Find in graph…"
        aria-label="Find in graph"
        spellCheck={false}
        onChange={(event) => onSearchChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onStep(event.shiftKey ? -1 : 1);
          } else if (event.key === 'Escape' && search) {
            event.stopPropagation();
            onSearchChange('');
          }
        }}
      />
      {position && (
        <>
          <span className={styles.count} aria-live="polite">
            {noMatches ? 'No matches' : `${position.current}/${position.total}`}
          </span>
          <span className={styles.actions}>
            <button
              type="button"
              className={styles.step}
              aria-label="Previous match"
              data-tip="Previous match"
              data-tip-shortcut="shift+enter"
              disabled={noMatches}
              onClick={() => onStep(-1)}
            >
              <ChevronUp size={14} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              className={styles.step}
              aria-label="Next match"
              data-tip="Next match"
              data-tip-shortcut="enter"
              disabled={noMatches}
              onClick={() => onStep(1)}
            >
              <ChevronDown size={14} strokeWidth={2.4} />
            </button>
            <button type="button" className={styles.step} aria-label="Clear search" data-tip="Clear" data-tip-shortcut="escape" onClick={clear}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </span>
        </>
      )}
    </div>
  );
}
