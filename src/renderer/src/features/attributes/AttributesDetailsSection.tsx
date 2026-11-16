import { DetailsSection } from '../../ui/DetailsSection';
import { AttributeChips } from './AttributeChips';
import { useAttributesShown } from './useAttributes';

/** An object's attribute chips in a titled section of a details panel; none when there's nothing to show or add. */
export function AttributesDetailsSection({ title, objectSpec }: { title: string; objectSpec: string }) {
  if (!useAttributesShown(objectSpec)) return null;
  return (
    <DetailsSection title={title}>
      <AttributeChips key={objectSpec} objectSpec={objectSpec} />
    </DetailsSection>
  );
}
