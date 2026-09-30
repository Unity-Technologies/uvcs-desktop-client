import { Pencil, X } from 'lucide-react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { attributeTone, attributeValueKind, chipText } from './attributeValues';
import styles from './AttributeChips.module.css';

interface AttributeChipProps {
  attribute: AttributeValue;
  /** Its value is open under the chips. */
  active: boolean;
  /** Opens the value to edit it, or to read a long one first. */
  onOpen: (mode: 'edit' | 'read') => void;
  /** Without it (a value being added) there is nothing to remove yet. */
  onRemove?: () => void;
}

/** `name: value`, tinted by what the value means; a link opens, a long text opens to be read; edit and remove on hover. */
export function AttributeChip({ attribute, active, onOpen, onRemove }: AttributeChipProps) {
  const kind = attributeValueKind(attribute.value);
  const value = attribute.value.trim();

  const open = (): void => {
    if (kind === 'url') void api.system.openExternal(value);
    else onOpen(kind === 'long' ? 'read' : 'edit');
  };

  return (
    <span className={styles.chip} data-tone={kind === 'pill' ? attributeTone(value) : 'neutral'} data-kind={kind} data-active={active}>
      <button className={styles.chipMain} onClick={open} data-tip={kind === 'url' ? value : kind === 'long' ? undefined : `${attribute.name}: ${value || 'empty'}`}>
        <span className={styles.chipName}>{attribute.name}</span>
        <span className={styles.chipValue}>{chipText(attribute.value)}</span>
      </button>
      <span className={styles.chipActions}>
        <button className={styles.chipAction} onClick={() => onOpen('edit')} aria-label={`Edit ${attribute.name}`} data-tip={`Edit ${attribute.name}`}>
          <Pencil size={11} />
        </button>
        {onRemove && (
          <button className={styles.chipAction} onClick={onRemove} aria-label={`Remove ${attribute.name}`} data-tip={`Remove ${attribute.name}`}>
            <X size={11} />
          </button>
        )}
      </span>
    </span>
  );
}
