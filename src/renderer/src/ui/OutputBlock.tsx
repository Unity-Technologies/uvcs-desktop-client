import { withControlPictures } from '../lib/controlPictures';
import styles from './OutputBlock.module.css';

/** A command's raw output, however long: monospaced, scrollable, selectable and never clipped; separators show. */
export function OutputBlock({ output }: { output: string }) {
  return (
    <pre className={`${styles.output} selectable`} tabIndex={0}>
      {output ? withControlPictures(output) : 'The command printed nothing.'}
    </pre>
  );
}
