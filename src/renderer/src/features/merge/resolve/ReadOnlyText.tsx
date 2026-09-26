import { File } from '@pierre/diffs/react';
import { useRef } from 'react';
import { PaneScrollbars } from '../../diff/viewer/PaneScrollbars';
import { usePierreOptions } from './usePierreOptions';
import styles from './TextSurface.module.css';
import { shownText } from '../../../lib/lineBreaks';
import { syntaxLanguage } from '../../../lib/syntaxLanguage';

/** A whole version of a file, highlighted and read-only; lone CRs break lines too. */
export function ReadOnlyText({ path, text }: { path: string; text: string }) {
  const options = usePierreOptions();
  const surface = useRef<HTMLDivElement>(null);
  return (
    <div ref={surface} className={styles.surface}>
      <File file={{ name: path, lang: syntaxLanguage(path), contents: shownText(text) }} disableWorkerPool options={options} />
      <PaneScrollbars containerRef={surface} />
    </div>
  );
}
