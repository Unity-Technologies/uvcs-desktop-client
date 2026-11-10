import { useRef } from 'react';
import { Pencil, X } from 'lucide-react';
import type { AttributeValue } from '@shared/domain/attribute';
import { api } from '../../api/client';
import { AnchoredCard, useHoverOpen } from '../../components/comments/AnchoredCard';
import { AttributeValueCard } from './AttributeValueCard';
import { attributeTone, attributeValueKind, chipHover, chipText } from './attributeValues';
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

/**
 * `name: value`, tinted by what the value means; a link opens, a long text opens to be read, and shows whole on hover,
 * its Markdown drawn (`chipHover`); edit and remove on hover.
 */
export function AttributeChip({ attribute, active, onOpen, onRemove }: AttributeChipProps) {
  const kind = attributeValueKind(attribute.value);
  const value = attribute.value.trim();
  const hover = chipHover(attribute, active);
  const main = useRef<HTMLButtonElement>(null);
  const card = useHoverOpen({ scrollable: true });

  const open = (): void => {
    // The chip keeps the focus that opened its card: closed now, it stays closed as the value opens and closes again.
    card.hide();
    if (kind === 'url') void api.system.openExternal(value);
    else onOpen(kind === 'long' ? 'read' : 'edit');
  };

  return (
    <span className={styles.chip} data-tone={kind === 'pill' ? attributeTone(value) : 'neutral'} data-kind={kind} data-active={active}>
      {/* An empty tip shows none: else the tooltip layer would show the clipped value's raw text before the card. */}
      <button ref={main} className={styles.chipMain} onClick={open} data-tip={hover.kind === 'tip' ? hover.text : ''} {...(hover.kind === 'card' ? card.handlers : {})}>
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
      {hover.kind === 'card' && card.open && (
        <AnchoredCard anchor={main} scrollWith={card.cardHandlers}>
          <AttributeValueCard name={attribute.name} markdown={hover.markdown} />
        </AnchoredCard>
      )}
    </span>
  );
}
