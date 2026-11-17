import { Plus } from 'lucide-react';
import { AddAttributeMenu } from './AttributeChips';
import styles from './AttributeChips.module.css';

interface AddAttributeButtonProps {
  /** The attribute types to offer (`AttributesSection.addable`); no button without one. */
  attributes: string[];
  onAdd: (attribute: string) => void;
}

/** "Add" at the right of an attributes section's title, and the menu of attributes to add behind it. */
export function AddAttributeButton({ attributes, onAdd }: AddAttributeButtonProps) {
  if (attributes.length === 0) return null;
  return (
    <AddAttributeMenu attributes={attributes} onAdd={onAdd} align="end">
      <button className={styles.add}>
        <Plus size={12} />
        Add
      </button>
    </AddAttributeMenu>
  );
}
