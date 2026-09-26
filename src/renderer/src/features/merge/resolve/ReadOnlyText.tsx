import { File } from '@pierre/diffs/react';
import { useRef } from 'react';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { usePierreOptions } from './usePierreOptions';
import styles from './TextSurface.module.css';

/** A whole version of a file, highlighted and read-only. */
export function ReadOnlyText({ path, text }: { path: string; text: string }) {
  const options = usePierreOptions();
  const surface = useRef<HTMLDivElement>(null);
  return (
    <div ref={surface} className={styles.surface}>
      <File file={{ name: path, contents: text }} disableWorkerPool options={options} />
      <PaneScrollbars containerRef={surface} />
    </div>
  );
}
