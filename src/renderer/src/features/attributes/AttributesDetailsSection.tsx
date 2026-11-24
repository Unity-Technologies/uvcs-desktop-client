import { DetailsEmpty, DetailsSection, DetailsSkeleton } from '../../ui/DetailsSection';
import { AddAttributeButton } from './AddAttributeButton';
import { AttributeChipList } from './AttributeChips';
import { useAttributesSection } from './useAttributesSection';

interface AttributesDetailsSectionProps {
  /** The object's spec, e.g. `br:/main/task`. */
  objectSpec: string;
  /** "Attributes" for the object's own; another object's says whose ("Branch attributes" on a review). */
  title?: string;
}

/**
 * An object's attributes in a details panel, as every panel shows them (docs/ARCHITECTURE.md "List and details"): a
 * titled section with Add at its right while there's an attribute to add, and a card under it: a placeholder while the
 * values are read, the chips, or "No attributes" (`attributesSectionOf`).
 */
export function AttributesDetailsSection({ objectSpec, title = 'Attributes' }: AttributesDetailsSectionProps) {
  // Keyed by the object, so another one starts with nothing opened or being added.
  return <AttributesSectionOf key={objectSpec} objectSpec={objectSpec} title={title} />;
}

function AttributesSectionOf({ objectSpec, title }: Required<AttributesDetailsSectionProps>) {
  const { editing, section } = useAttributesSection(objectSpec);
  if (section.body === 'hidden') return null;
  return (
    <DetailsSection title={title} action={<AddAttributeButton attributes={section.addable} onAdd={editing.add} />}>
      {section.body === 'reading' && <DetailsSkeleton rows={1} />}
      {section.body === 'none' && <DetailsEmpty>No attributes</DetailsEmpty>}
      {section.body === 'chips' && <AttributeChipList editing={editing} inCard />}
    </DetailsSection>
  );
}
