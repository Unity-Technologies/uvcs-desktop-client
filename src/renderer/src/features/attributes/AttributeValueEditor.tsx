import { useRef, useState } from 'react';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { attributeTone, outgrowsQuickField } from './attributeValues';
import styles from './AttributeChips.module.css';

interface AttributeValueEditorProps {
  initialValue: string;
  /** Values to pick with one click, e.g. the ones the attribute already takes elsewhere. */
  suggestions: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
  /** The draft gained a second line: the comment editor takes it from here (`outgrowsQuickField`). */
  onOutgrown: (draft: string) => void;
}

/**
 * Edits a short value in place: Enter saves, Escape cancels, clicking a suggestion saves it; Shift+Enter, or a paste of
 * many lines, hands the draft to the comment editor (`AttributeTextEditor`).
 */
export function AttributeValueEditor({ initialValue, suggestions, onSave, onCancel, onOutgrown }: AttributeValueEditorProps) {
  const [draft, setDraft] = useState(initialValue);
  // Handed on, the field leaves: a blur it may still get saves nothing.
  const handedOn = useRef(false);
  // Until the user types, every suggestion shows: the selected value is replaced by the first keystroke anyway.
  const typed = draft === initialValue ? '' : draft;
  const offered = suggestions.filter((suggestion) => suggestion !== draft.trim() && matchesWordFilter([suggestion], typed));

  // A value left as it was is no edit.
  const finish = (value: string): void => {
    if (handedOn.current) return;
    if (value === initialValue) onCancel();
    else onSave(value);
  };

  return (
    <div className={styles.editing}>
      <textarea
        className={styles.editor}
        value={draft}
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        rows={1}
        onChange={(event) => {
          const next = event.target.value;
          if (!outgrowsQuickField(next)) return setDraft(next);
          handedOn.current = true;
          onOutgrown(next);
        }}
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
        <HighlightQuery query={typed}>
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
                  <Highlight text={suggestion} />
                </span>
              </button>
            ))}
          </div>
        </HighlightQuery>
      )}
      <span className={styles.hint}>↵ save · ⇧↵ new line · Esc cancel</span>
    </div>
  );
}
