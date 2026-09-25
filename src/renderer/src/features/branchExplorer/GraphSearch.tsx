import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useRef, type Ref } from 'react';
import { hotkey } from '../../lib/shortcutRegistry';
import styles from './GraphSearch.module.css';

interface GraphSearchProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** Null while there is no search; `current` is 0 before stepping through the matches. */
  position: { current: number; total: number } | null;
  onStep: (direction: 1 | -1) => void;
  inputRef: Ref<HTMLInputElement>;
  /** Escape in an empty field: back to the graph. */
  onLeave: () => void;
}

/**
 * Finds changesets by number, comment or author, and branches and labels by name. Like a find bar, the field holds
 * the match counter and the previous / next / clear buttons; Enter and Shift+Enter step. Escape clears the search
 * (the match reached stays selected), and in an empty field goes back to the graph.
 */
export function GraphSearch({ search, onSearchChange, position, onStep, inputRef, onLeave }: GraphSearchProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const noMatches = position?.total === 0;
  const clear = (): void => {
    onSearchChange('');
    // Clearing restarts the search, it doesn't end it: the caret stays in the field.
    fieldRef.current?.querySelector('input')?.focus();
  };

  return (
    <div ref={fieldRef} className={styles.field} data-active={position !== null} data-empty={noMatches}>
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
          } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (search) onSearchChange('');
            else onLeave();
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
              data-tip-shortcut={hotkey('graphPreviousMatch')}
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
              data-tip-shortcut={hotkey('graphNextMatch')}
              disabled={noMatches}
              onClick={() => onStep(1)}
            >
              <ChevronDown size={14} strokeWidth={2.4} />
            </button>
            <button type="button" className={styles.step} aria-label="Clear search" data-tip="Clear" data-tip-shortcut={hotkey('graphClearFind')} onClick={clear}>
              <X size={13} strokeWidth={2.2} />
            </button>
          </span>
        </>
      )}
    </div>
  );
}
