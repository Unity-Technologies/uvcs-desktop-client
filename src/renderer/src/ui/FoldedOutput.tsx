import { useState } from 'react';
import { DetailsDisclosure } from './DetailsDisclosure';
import { OutputBlock } from './OutputBlock';
import styles from './FoldedOutput.module.css';

/**
 * What failed, word for word (an error, a command's output), folded under Details: a screen that stands in for the app
 * says what happened in plain words, and keeps this for a bug report.
 */
export function FoldedOutput({ output }: { output: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.folded}>
      <DetailsDisclosure open={open} onToggle={() => setOpen(!open)}>
        Details
      </DetailsDisclosure>
      {open && <OutputBlock output={output} />}
    </div>
  );
}
