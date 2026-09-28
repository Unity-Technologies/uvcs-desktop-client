import type { Icon } from '../lib/actions';
import { Highlight } from '../ui/Highlight';
import { cellText } from '../ui/table/cellText';
import styles from './ObjectName.module.css';

interface ObjectNameProps {
  /** The object's kind, as the sidebar and its details show it (a tag for labels, tags for attributes). */
  icon: Icon;
  name: string;
}

/** A list row's name, as Branches draws its own: the kind's quiet icon, then the name with the filter's words marked. */
export function ObjectName({ icon: KindIcon, name }: ObjectNameProps) {
  return (
    <span className={styles.name}>
      <KindIcon size={13} className={styles.icon} />
      {cellText(<Highlight text={name} />)}
    </span>
  );
}
