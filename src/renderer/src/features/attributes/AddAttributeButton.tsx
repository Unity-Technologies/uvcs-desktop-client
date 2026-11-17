import { Plus } from 'lucide-react';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import styles from './AttributeChips.module.css';

interface AddAttributeButtonProps {
  /** The attribute types to offer (`AttributesSection.addable`); no button without one. */
  attributes: string[];
  onAdd: (attribute: string) => void;
}

/** "Add" at the right of an attributes section's title, and the menu of attributes to add behind it, lined up with its end. */
export function AddAttributeButton({ attributes, onAdd }: AddAttributeButtonProps) {
  if (attributes.length === 0) return null;
  return (
    <ActionDropdownMenu align="end" entries={attributes.map((name) => ({ id: name, label: name, run: () => onAdd(name) }))}>
      <button className={styles.add}>
        <Plus size={12} />
        Add
      </button>
    </ActionDropdownMenu>
  );
}
