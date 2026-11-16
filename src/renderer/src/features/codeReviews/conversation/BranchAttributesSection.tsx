import { AttributeChips } from '../../attributes/AttributeChips';
import { useAttributesShown } from '../../attributes/useAttributes';
import styles from './ReviewConversation.module.css';

/**
 * The reviewed branch's attributes beside the conversation, edited in place (`AttributeChips`), as the branch's own
 * details show them: where the work is reviewed, its tracking attributes (a status, a release) are at hand. None when
 * there's nothing to show or add (`useAttributesShown`).
 */
export function BranchAttributesSection({ branchSpec }: { branchSpec: string }) {
  if (!useAttributesShown(branchSpec)) return null;
  return (
    <section className={styles.railSection} aria-labelledby="review-branch-attributes">
      <h2 id="review-branch-attributes" className={styles.railTitle}>
        Branch attributes
      </h2>
      <AttributeChips key={branchSpec} objectSpec={branchSpec} />
    </section>
  );
}
