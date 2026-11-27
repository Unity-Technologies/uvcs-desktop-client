import { Fragment } from 'react';
import { Kbd } from '../../../ui/Kbd';
import styles from './KeyboardPane.module.css';

/** A shortcut's keys as caps, its alternatives after a slash. */
export function KeyCaps({ keys }: { keys: readonly string[] }) {
  return keys.map((key, index) => (
    <Fragment key={key}>
      {index > 0 && <span className={styles.or}>/</span>}
      <Kbd keys={key} />
    </Fragment>
  ));
}
