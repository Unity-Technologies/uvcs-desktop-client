import { useState } from 'react';
import { attributeTone } from './attributeValues';
import styles from './AttributeChips.module.css';

const MAX_ROWS = 12;

interface AttributeValueEditorProps {
  initialValue: string;
  /** Values to pick with one click, e.g. the ones the attribute already takes elsewhere. */
  suggestions: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
}

/** Edits a value in place: Enter saves, Shift+Enter adds a line, Escape cancels; clicking a suggestion saves it. */
export function AttributeValueEditor({ initialValue, suggestions, onSave, onCancel }: AttributeValueEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  // Until the user types, every suggestion shows: the selected value is replaced by the first keystroke anyway.
  const needle = draft === initialValue ? '' : draft.trim().toLowerCase();
  const offered = suggestions.filter((suggestion) => suggestion !== draft.trim() && suggestion.toLowerCase().includes(needle));

  const finish = (value: string): void => (value !== initialValue ? onSave(value) : onCancel());

  return (
    <div className={styles.editing}>
      <textarea
        className={styles.editor}
        value={draft}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        rows={Math.min(MAX_ROWS, Math.max(1, draft.split('\n').length))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => finish(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            finish(draft);
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            onCancel();
          }
        }}
      />
      {offered.length > 0 && (
        <div className={styles.suggestions}>
          {offered.map((suggestion) => (
            <button
              key={suggestion}
              className={styles.pillButton}
              // Keeps the focus in the editor, so its blur doesn't save the draft first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => finish(suggestion)}
            >
              <span className={styles.pill} data-tone={attributeTone(suggestion)}>
                {suggestion}
              </span>
            </button>
          ))}
        </div>
      )}
      <span className={styles.hint}>↵ save · ⇧↵ new line · Esc cancel</span>
    </div>
  );
}
