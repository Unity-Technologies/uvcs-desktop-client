import { attributesSectionOf, type AttributesSection } from './attributeValues';
import { useAttributeEditing, type AttributeEditing } from './useAttributeEditing';

/**
 * An object's attributes as a titled section shows them, whatever frames it (a details panel's `AttributesDetailsSection`,
 * the review page's `BranchAttributesSection`): its values being edited, and what the section shows and offers to add.
 */
export function useAttributesSection(objectSpec: string): { editing: AttributeEditing; section: AttributesSection } {
  const editing = useAttributeEditing(objectSpec);
  return { editing, section: attributesSectionOf(editing.values, editing.types, editing.adding) };
}
