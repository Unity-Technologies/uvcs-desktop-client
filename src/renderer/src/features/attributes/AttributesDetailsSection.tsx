import { Plus } from 'lucide-react';
import { DetailsEmpty, DetailsSection, DetailsSkeleton } from '../../ui/DetailsSection';
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
 * titled section with Add at its right while there's an attribute to add, and a card under it: a placeholder while the values are read, the chips,
 * or "No attributes" (`attributesSectionOf`).
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
      <button className={styles.add}>
        <Plus size={12} />
        Add
      </button>
    </AddAttributeMenu>
  );
  return (
    <DetailsSection title={title} action={add}>
      {section.body === 'reading' && <DetailsSkeleton rows={1} />}
      {section.body === 'none' && <DetailsEmpty>No attributes</DetailsEmpty>}
      {section.body === 'chips' && <AttributeChipList editing={editing} inCard />}
    </DetailsSection>
  );
}
