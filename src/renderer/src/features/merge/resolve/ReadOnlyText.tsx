import { File } from '@pierre/diffs/react';
import { usePierreOptions } from './usePierreOptions';
import styles from './TextSurface.module.css';

/** A whole version of a file, highlighted and read-only. */
export function ReadOnlyText({ path, text }: { path: string; text: string }) {
  const options = usePierreOptions();
  return (
    <div className={styles.surface}>
      <File file={{ name: path, contents: text }} disableWorkerPool options={options} />
    </div>
  );
}
