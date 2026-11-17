import { Plus } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { Markdown } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { AttributeChip } from './AttributeChip';
import { AttributeTextEditor } from './AttributeTextEditor';
import { attributeEditorFor, attributesSectionOf, hasAttributesToShow } from './attributeValues';
import { AttributeValueEditor } from './AttributeValueEditor';
import { useAttributeSuggestions } from './useAttributes';
import { useAttributeEditing, type AttributeEditing } from './useAttributeEditing';
import styles from './AttributeChips.module.css';

/** Chips shown before "+N" folds the rest away. */
const MAX_CHIPS = 4;

/**
 * The attribute values of a branch, changeset or label as compact chips (`status: resolved`), edited in place:
 * click a chip (or its pencil) to edit, its cross to remove, "Add attribute…" after them for a new one. A details
 * panel shows them in its Attributes section instead (`AttributesDetailsSection`), its Add in the section's title.
 */
export function AttributeChips({ objectSpec }: { objectSpec: string }) {
  const editing = useAttributeEditing(objectSpec);
  const { values, types, rows } = editing;

  if (!values) return <div className={styles.loading} aria-busy="true" aria-label="Loading attributes" />;
  if (!hasAttributesToShow(rows, types)) return null;

  const { addable } = attributesSectionOf(values, types, editing.adding);
  return (
    <AttributeChipList
      editing={editing}
      add={
        addable.length > 0 && (
          <AddAttributeMenu attributes={addable} onAdd={editing.add}>
            <button className={styles.add}>
              <Plus size={12} />
              Add attribute…
            </button>
          </AddAttributeMenu>
        )
      }
    />
  );
}

interface AddAttributeMenuProps {
  attributes: string[];
  onAdd: (attribute: string) => void;
  /** Which edge of the button the menu lines up with: its start after the chips, its end at a section title's right. */
  align?: 'start' | 'end';
  children: ReactElement;
}

/** The menu of attributes to add, behind the button it's given. */
export function AddAttributeMenu({ attributes, onAdd, align = 'start', children }: AddAttributeMenuProps) {
  return (
    <ActionDropdownMenu align={align} entries={attributes.map((name) => ({ id: name, label: name, run: () => onAdd(name) }))}>
      {children}
    </ActionDropdownMenu>
  );
}

interface AttributeChipListProps {
  editing: AttributeEditing;
  /** After the chips, e.g. "Add attribute…". */
  add?: ReactNode;
  /** In a details section's card, whose tint the value opened under the chips stands out from. */
  inCard?: boolean;
}

/** The chips of `editing`'s rows, "+N" for those folded away, `add` after them, and under them the value opened. */
export function AttributeChipList({ editing, add, inCard = false }: AttributeChipListProps) {
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
        {add}
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
