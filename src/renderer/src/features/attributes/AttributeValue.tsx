import { useState } from 'react';
import { ExternalLink, Markdown } from '../../components/Markdown';
import { markdownPreview } from '../../lib/markdown';
import { attributeTone, attributeValueKind } from './attributeValues';
import styles from './AttributesEditor.module.css';

/** An attribute value shown the way it reads best: a status pill, a link, or long text folded to one line. */
export function AttributeValue({ value, onEdit }: { value: string; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const kind = attributeValueKind(value);

  switch (kind) {
    case 'empty':
      return (
        <button className={`${styles.value} ${styles.placeholder}`} onClick={onEdit}>
          Empty
        </button>
      );
    case 'pill':
      return (
        <button className={styles.pillButton} onClick={onEdit}>
          <span className={styles.pill} data-tone={attributeTone(value)}>
            {value.trim()}
          </span>
        </button>
      );
    case 'url':
      return (
        <span className={`${styles.value} ${styles.url}`}>
          <ExternalLink url={value.trim()}>{value.trim().replace(/^https?:\/\//i, '')}</ExternalLink>
        </span>
      );
    case 'text':
      return (
        <button className={styles.value} onClick={onEdit}>
          {value}
        </button>
      );
    case 'long':
      return expanded ? (
        <div className={styles.long}>
          <Markdown text={value} />
          <button className={styles.toggle} onClick={() => setExpanded(false)}>
            Show less
          </button>
        </div>
      ) : (
        <div className={styles.folded}>
          <span className={styles.preview}>{markdownPreview(value)}</span>
          <button className={styles.toggle} onClick={() => setExpanded(true)}>
            Show more
          </button>
        </div>
      );
  }
}
