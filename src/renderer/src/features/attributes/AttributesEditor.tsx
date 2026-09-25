import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { runAction } from '../../app/operations/runOperation';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { Button } from '../../ui/Button';
import { DetailsEmpty, DetailsSection } from '../../ui/DetailsPanel';
import { IconButton } from '../../ui/IconButton';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { useAttributeTypes, useAttributeValues } from './useAttributes';
import styles from './AttributesEditor.module.css';

/**
 * Shows and edits the attribute values of a branch, changeset or label.
 * Embed it in any details panel: `<AttributesEditor objectSpec="br:/main/task" />`.
 */
export function AttributesEditor({ objectSpec }: { objectSpec: string }) {
  const workspacePath = useWorkspacePath();
  const { data: values = [] } = useAttributeValues(objectSpec);
  const { data: types = [] } = useAttributeTypes();
  const [adding, setAdding] = useState<string | null>(null);

  const unused = types.filter((type) => !values.some((value) => value.name === type.name));
  const rows: AttributeValue[] = adding ? [...values, { name: adding, value: '' }] : values;

  const save = async (attribute: string, value: string): Promise<void> => {
    setAdding(null);
    await runAction(workspacePath, `Couldn't set ${attribute}`, () => api.attributes.setValue(workspacePath, objectSpec, attribute, value));
  };

  const remove = (attribute: string): Promise<void | undefined> =>
    runAction(workspacePath, `Couldn't remove ${attribute}`, () => api.attributes.unsetValue(workspacePath, objectSpec, attribute));

  const addMenu = unused.map((type) => ({ id: type.name, label: type.name, run: () => setAdding(type.name) }));

  return (
    <DetailsSection
      title="Attributes"
      action={
        unused.length > 0 && (
          <ActionDropdownMenu entries={addMenu}>
            <Button variant="ghost" size="small" icon={<Plus size={13} />}>
              Add
            </Button>
          </ActionDropdownMenu>
        )
      }
    >
      {rows.length === 0 ? (
        <DetailsEmpty>No attributes yet.</DetailsEmpty>
      ) : (
        <div className={styles.list}>
          {rows.map((row) => (
            <AttributeRow
              key={row.name}
              attribute={row}
              startEditing={row.name === adding}
              onSave={(value) => void save(row.name, value)}
              onCancel={() => row.name === adding && setAdding(null)}
              onRemove={() => void remove(row.name)}
            />
          ))}
        </div>
      )}
    </DetailsSection>
  );
}

interface AttributeRowProps {
  attribute: AttributeValue;
  startEditing: boolean;
  onSave: (value: string) => void;
  onCancel: () => void;
  onRemove: () => void;
}

function AttributeRow({ attribute, startEditing, onSave, onCancel, onRemove }: AttributeRowProps) {
  const [draft, setDraft] = useState<string | null>(startEditing ? '' : null);

  const finish = (): void => {
    if (draft !== null && draft !== attribute.value) onSave(draft);
    else onCancel();
    setDraft(null);
  };

  return (
    <div className={styles.row}>
      <span className={styles.name}>{attribute.name}</span>
      {draft === null ? (
        <button className={styles.value} onClick={() => setDraft(attribute.value)} title="Click to edit">
          {attribute.value || <span className={styles.placeholder}>Empty</span>}
        </button>
      ) : (
        <textarea
          className={styles.editor}
          value={draft}
          autoFocus
          rows={Math.min(6, Math.max(1, draft.split('\n').length))}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={finish}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              finish();
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              setDraft(null);
              onCancel();
            }
          }}
        />
      )}
      {!startEditing && <IconButton size="small" icon={<X size={12} />} label={`Remove ${attribute.name}`} onClick={onRemove} />}
    </div>
  );
}
