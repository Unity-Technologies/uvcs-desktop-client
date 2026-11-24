import { useId } from 'react';
import { DetailsSkeleton } from '../../../ui/DetailsSection';
import { AddAttributeButton } from '../../attributes/AddAttributeButton';
import { AttributeChipList } from '../../attributes/AttributeChips';
import { useAttributesSection } from '../../attributes/useAttributesSection';
import styles from './ReviewConversation.module.css';

/**
 * The reviewed branch's attributes beside the conversation, edited in place, as the branch's own details show them
 * (`AttributesDetailsSection`: Add at the title's right, then a placeholder, the chips or "No attributes"), framed as
 * the rail's other sections are, with no card. Where the work is reviewed, its tracking attributes (a status, a
 * release) are at hand. None when there's nothing to show or add (`attributesSectionOf`).
 */
export function BranchAttributesSection({ branchSpec }: { branchSpec: string }) {
  // Keyed by the branch, so another review's starts with nothing opened or being added.
  return <BranchAttributesOf key={branchSpec} branchSpec={branchSpec} />;
}

function BranchAttributesOf({ branchSpec }: { branchSpec: string }) {
  // Its own per page: a review may show in two views kept mounted (`KeptView`).
  const titleId = useId();
  const { editing, section } = useAttributesSection(branchSpec);
  if (section.body === 'hidden') return null;
  return (
    <section className={styles.railSection} aria-labelledby={titleId}>
      <div className={styles.railHeading}>
        <h2 id={titleId} className={styles.railTitle}>
          Branch attributes
        </h2>
        <AddAttributeButton attributes={section.addable} onAdd={editing.add} />
      </div>
      {section.body === 'reading' && <DetailsSkeleton rows={1} />}
      {section.body === 'none' && <p className={styles.railEmpty}>No attributes</p>}
      {section.body === 'chips' && <AttributeChipList editing={editing} />}
    </section>
  );
}
