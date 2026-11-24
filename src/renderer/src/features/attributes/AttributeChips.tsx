import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { Markdown } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { AttributeChip } from './AttributeChip';
import { AttributeTextEditor } from './AttributeTextEditor';
import { attributeEditorFor } from './attributeValues';
import { AttributeValueEditor } from './AttributeValueEditor';
import { useAttributeSuggestions } from './useAttributes';
import type { AttributeEditing } from './useAttributeEditing';
import styles from './AttributeChips.module.css';

/** Chips shown before "+N" folds the rest away. */
const MAX_CHIPS = 4;

interface AttributeChipListProps {
  editing: AttributeEditing;
  /** In a details section's card, whose tint the value opened under the chips stands out from. */
  inCard?: boolean;
}

/** The chips of `editing`'s rows, "+N" for those folded away, and under them the value opened. */
export function AttributeChipList({ editing, inCard = false }: AttributeChipListProps) {
  const [showAll, setShowAll] = useState(false);
  const { rows, opened, adding } = editing;

  const hidden = showAll ? 0 : Math.max(0, rows.length - MAX_CHIPS);
  const visible = hidden > 0 ? rows.slice(0, MAX_CHIPS) : rows;
  const openedRow = opened && rows.find((row) => row.name === opened.name);

  return (
    <div className={styles.attributes} data-in-card={inCard}>
      <div className={styles.chips}>
        {visible.map((row) => (
          <AttributeChip
            key={row.name}
            attribute={row}
            active={opened?.name === row.name}
            onOpen={(mode) => editing.open(opened?.name === row.name && opened.mode === mode ? null : { name: row.name, mode })}
            onRemove={row.name === adding ? undefined : () => editing.remove(row.name)}
          />
        ))}
        {hidden > 0 && (
          <button className={styles.more} onClick={() => setShowAll(true)} data-tip={rows.slice(MAX_CHIPS).map((row) => row.name).join(', ')}>
            +{hidden}
          </button>
        )}
      </div>
      {opened && openedRow && (
        <div className={styles.opened}>
          <span className={styles.openedName}>{openedRow.name}</span>
          {opened.mode === 'edit' ? (
            <OpenedEditor
              key={openedRow.name}
              attribute={openedRow}
              onSave={(value) => void editing.save(openedRow.name, value)}
              onSaveText={(value) => editing.setValue(openedRow.name, value)}
              onCancel={editing.close}
            />
          ) : (
            <>
              <Markdown text={openedRow.value} />
              <div className={styles.openedActions}>
                <Button size="small" variant="ghost" onClick={() => editing.open({ name: openedRow.name, mode: 'edit' })}>
                  Edit
                </Button>
                <Button size="small" variant="ghost" onClick={editing.close}>
                  Close
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface OpenedEditorProps {
  attribute: AttributeValue;
  onSave: (value: string) => void;
  /** Resolves to whether it saved. */
  onSaveText: (value: string) => Promise<boolean>;
  onCancel: () => void;
}

/** A value's editor (`attributeEditorFor`): the quick field, or the comment editor, which a quick draft can move on to. */
function OpenedEditor({ attribute, onSave, onSaveText, onCancel }: OpenedEditorProps) {
  const [textDraft, setTextDraft] = useState(() => (attributeEditorFor(attribute.value) === 'text' ? attribute.value.trim() : null));
  const suggestions = useAttributeSuggestions(attribute.name, textDraft === null);
  if (textDraft !== null) return <AttributeTextEditor attribute={attribute.name} original={attribute.value} initialDraft={textDraft} onSave={onSaveText} onClose={onCancel} />;
  return <AttributeValueEditor initialValue={attribute.value} suggestions={suggestions} onSave={onSave} onCancel={onCancel} onOutgrown={setTextDraft} />;
}
