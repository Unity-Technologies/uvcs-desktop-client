import { useLayoutEffect, useRef, useState } from 'react';
import { PathLabel } from '../../components/PathLabel';
import { textMeasurer } from '../../lib/measureText';
import { fitMergeTitle } from './fitMergeTitle';
import { mergeTitleText, type MergeTitle } from './mergeDescription';
import styles from './MergeHeader.module.css';

/** "Merge /main/…/task into /main": fitted as a whole, the branches give way from their middle and the words stay. */
export function MergeHeading({ title }: { title: MergeTitle }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [fitted, setFitted] = useState(title);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // A few pixels to spare for the gaps between the parts, which the measure of their text leaves out.
    const fit = (): void => setFitted(fitMergeTitle(title, element.clientWidth - 8, textMeasurer(element)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [title]);

  return (
    <h1 ref={ref} className={styles.title} data-tip={mergeTitleText(title)}>
      <span className={styles.titleWord}>{fitted.verb}</span>
      <PathLabel path={fitted.source} fitContent tooltip={false} />
      <span className={styles.titleWord}>{fitted.preposition}</span>
      <PathLabel path={fitted.destination} fitContent tooltip={false} />
    </h1>
  );
}
