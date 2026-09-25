import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Markdown } from '../../components/Markdown';
import { Button } from '../../ui/Button';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { AttributeChip } from './AttributeChip';
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
  const workspacePath = useWorkspacePath();
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

  const save = async (attribute: string, value: string): Promise<void> => {
    close();
    await runAction(workspacePath, `Couldn't set ${attribute}`, () => api.attributes.setValue(workspacePath, objectSpec, attribute, value));
  };

  const remove = (attribute: string): void => {
    if (opened?.name === attribute) close();
    void runAction(workspacePath, `Couldn't remove ${attribute}`, () => api.attributes.unsetValue(workspacePath, objectSpec, attribute));
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
            <OpenedEditor key={openedRow.name} attribute={openedRow} onSave={(value) => void save(openedRow.name, value)} onCancel={close} />
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

function OpenedEditor({ attribute, onSave, onCancel }: { attribute: AttributeValue; onSave: (value: string) => void; onCancel: () => void }) {
  const suggestions = useAttributeSuggestions(attribute.name, true);
  return <AttributeValueEditor initialValue={attribute.value} suggestions={suggestions} onSave={onSave} onCancel={onCancel} />;
}
