import { Plus } from 'lucide-react';
import { DetailsSection } from '../../ui/DetailsSection';
import { AddAttributeMenu, AttributeChipList } from './AttributeChips';
import { attributesSectionOf } from './attributeValues';
import { useAttributeEditing } from './useAttributeEditing';
import styles from './AttributeChips.module.css';

interface AttributesDetailsSectionProps {
  /** The object's spec, e.g. `br:/main/task`. */
  objectSpec: string;
  /** "Attributes" for the object's own; another object's says whose ("Branch attributes" on a review). */
  title?: string;
}

/**
 * An object's attributes in a details panel, as every panel shows them (docs/ARCHITECTURE.md "List and details"): a
 * titled section with Add at its right, its chips in a card, and no card when it has none (`attributesSectionOf`).
 */
export function AttributesDetailsSection({ objectSpec, title = 'Attributes' }: AttributesDetailsSectionProps) {
  // Keyed by the object, so another one starts with nothing opened or being added.
  return <AttributesSectionOf key={objectSpec} objectSpec={objectSpec} title={title} />;
}

function AttributesSectionOf({ objectSpec, title }: Required<AttributesDetailsSectionProps>) {
  const editing = useAttributeEditing(objectSpec);
  const section = attributesSectionOf(editing.values, editing.types, editing.adding);
  if (section.body === 'hidden') return null;

  const add = section.addable.length > 0 && (
    <AddAttributeMenu attributes={section.addable} onAdd={editing.add} align="end">
      <button className={styles.add} data-tip="Add an attribute">
        <Plus size={12} />
        Add
      </button>
    </AddAttributeMenu>
  );
  return (
    <DetailsSection title={title} action={add}>
      {section.body === 'chips' && <AttributeChipList editing={editing} inCard />}
    </DetailsSection>
  );
}
