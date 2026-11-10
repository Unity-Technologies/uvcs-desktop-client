import { Markdown } from '../../components/Markdown';
import styles from './AttributeChips.module.css';

/** A long value shown whole on its chip's hover, its Markdown drawn; one taller than the card scrolls. */
export function AttributeValueCard({ name, markdown }: { name: string; markdown: string }) {
  return (
    <div className={styles.valueCard}>
      <span className={styles.openedName}>{name}</span>
      <Markdown text={markdown} />
    </div>
  );
}
