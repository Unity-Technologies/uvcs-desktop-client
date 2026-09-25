import { Pencil, X } from 'lucide-react';
import { useState } from 'react';
import type { AttributeValue as AttributeValueModel } from '@shared/domain/attribute';
import { IconButton } from '../../ui/IconButton';
import { AttributeValue } from './AttributeValue';
import { AttributeValueEditor } from './AttributeValueEditor';
import { useAttributeSuggestions } from './useAttributes';
import styles from './AttributesEditor.module.css';

interface AttributeRowProps {
  attribute: AttributeValueModel;
  /** A row just added, which opens in the editor. */
  isNew: boolean;
  onSave: (value: string) => void;
  /** Leaves the editor without changes; a new row goes away. */
  onCancel: () => void;
  onRemove: () => void;
}

export function AttributeRow({ attribute, isNew, onSave, onCancel, onRemove }: AttributeRowProps) {
  const [editing, setEditing] = useState(isNew);
  const suggestions = useAttributeSuggestions(attribute.name, editing);

  const stopEditing = (): void => {
    setEditing(false);
    onCancel();
  };

  return (
    <div className={styles.row} data-editing={editing}>
      <span className={styles.name} data-tip={attribute.name} data-tip-overflow>
        {attribute.name}
      </span>
      {editing ? (
        <AttributeValueEditor
          initialValue={attribute.value}
          suggestions={suggestions}
          onSave={(value) => {
            setEditing(false);
            onSave(value);
          }}
          onCancel={stopEditing}
        />
      ) : (
        <AttributeValue value={attribute.value} onEdit={() => setEditing(true)} />
      )}
      {!editing && (
        <span className={styles.rowActions}>
          <IconButton size="small" icon={<Pencil size={12} />} label={`Edit ${attribute.name}`} onClick={() => setEditing(true)} />
          <IconButton size="small" icon={<X size={12} />} label={`Remove ${attribute.name}`} onClick={onRemove} />
        </span>
      )}
    </div>
  );
}
