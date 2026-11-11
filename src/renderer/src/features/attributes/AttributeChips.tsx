import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { isAffectedByAttributes } from '../../app/refresh/refreshScopes';
import { usePlace } from '../../app/workspace/useWorkspace';
import { Markdown } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { AttributeChip } from './AttributeChip';
import { AttributeTextEditor } from './AttributeTextEditor';
import { attributeEditorFor } from './attributeValues';
import { AttributeValueEditor } from './AttributeValueEditor';
import { useAttributeSuggestions, useAttributeTypes, useAttributeValues } from './useAttributes';
import styles from './AttributeChips.module.css';

/** Chips shown before "+N" folds the rest away. */
const MAX_CHIPS = 4;

/** The attribute the panel under the chips shows: its value being edited, or a long value being read. */
type Opened = { name: string; mode: 'edit' | 'read' };

/**
 * The attribute values of a branch, changeset or label as compact chips (`status: resolved`), edited in place:
 * click a chip (or its pencil) to edit, its cross to remove, "Add attribute…" for a new one.
 */
export function AttributeChips({ objectSpec }: { objectSpec: string }) {
  const place = usePlace();
  const { data: values } = useAttributeValues(objectSpec);
  const { data: types = [] } = useAttributeTypes();
  const [adding, setAdding] = useState<string | null>(null);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (!values) return <div className={styles.loading} aria-busy="true" aria-label="Loading attributes" />;

  const unused = types.filter((type) => !values.some((value) => value.name === type.name));
  const rows: AttributeValue[] = adding ? [...values, { name: adding, value: '' }] : values;
  if (rows.length === 0 && unused.length === 0) return null;

  const hidden = showAll ? 0 : Math.max(0, rows.length - MAX_CHIPS);
  const visible = hidden > 0 ? rows.slice(0, MAX_CHIPS) : rows;
  const openedRow = opened && rows.find((row) => row.name === opened.name);

  const close = (): void => {
    setOpened(null);
    setAdding(null);
  };

  const setValue = async (attribute: string, value: string): Promise<boolean> => {
    const set = async (): Promise<true> => {
      await api.attributes.setValue(place, objectSpec, attribute, value);
      return true;
    };
    return (await runAction(place, `Couldn't set ${attribute}`, set, isAffectedByAttributes)) === true;
  };

  // A quick value closes as it saves; a text stays open until it's saved, so a failure leaves it to try again.
  const save = async (attribute: string, value: string): Promise<void> => {
    close();
    await setValue(attribute, value);
  };

  const remove = (attribute: string): void => {
    if (opened?.name === attribute) close();
    void runAction(place, `Couldn't remove ${attribute}`, () => api.attributes.unsetValue(place, objectSpec, attribute), isAffectedByAttributes);
  };

  const add = (attribute: string): void => {
    setAdding(attribute);
    setOpened({ name: attribute, mode: 'edit' });
  };

  return (
    <div className={styles.attributes}>
      <div className={styles.chips}>
        {visible.map((row) => (
          <AttributeChip
            key={row.name}
            attribute={row}
            active={opened?.name === row.name}
            onOpen={(mode) => setOpened(opened?.name === row.name && opened.mode === mode ? null : { name: row.name, mode })}
            onRemove={row.name === adding ? undefined : () => remove(row.name)}
          />
        ))}
        {hidden > 0 && (
          <button className={styles.more} onClick={() => setShowAll(true)} data-tip={rows.slice(MAX_CHIPS).map((row) => row.name).join(', ')}>
            +{hidden}
          </button>
        )}
        {unused.length > 0 && !adding && (
          <ActionDropdownMenu align="start" entries={unused.map((type) => ({ id: type.name, label: type.name, run: () => add(type.name) }))}>
            <button className={styles.add}>
              <Plus size={12} />
              Add attribute…
            </button>
          </ActionDropdownMenu>
        )}
      </div>
      {opened && openedRow && (
        <div className={styles.opened}>
          <span className={styles.openedName}>{openedRow.name}</span>
          {opened.mode === 'edit' ? (
            <OpenedEditor
              key={openedRow.name}
              attribute={openedRow}
              onSave={(value) => void save(openedRow.name, value)}
              onSaveText={(value) => setValue(openedRow.name, value)}
              onCancel={close}
            />
          ) : (
            <>
              <Markdown text={openedRow.value} />
              <div className={styles.openedActions}>
                <Button size="small" variant="ghost" onClick={() => setOpened({ name: openedRow.name, mode: 'edit' })}>
                  Edit
                </Button>
                <Button size="small" variant="ghost" onClick={close}>
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
