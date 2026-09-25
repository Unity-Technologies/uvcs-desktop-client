import { useLayoutEffect, useRef, useState } from 'react';
import { textMeasurer } from '../../lib/measureText';
import type { CheckinButtonText } from './checkinButton';
import styles from './CheckinPanel.module.css';

/** The gap between the action, the target and the size, as in the stylesheet. */
const PART_GAP = 6;

/**
 * The check-in button's text: the longest of its wordings that fits the button, so it loses the size, then the
 * branch, before a word is ever cut. Sits directly in the button, whose width it measures.
 */
export function CheckinButtonWording({ forms }: { forms: CheckinButtonText[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  const formsKey = JSON.stringify(forms);

  useLayoutEffect(() => {
    const label = ref.current;
    const button = label?.parentElement;
    if (!label || !button) return;
    const fit = (): void => {
      const style = getComputedStyle(button);
      const gap = parseFloat(style.columnGap) || 0;
      const besideLabel = [...button.children].filter((child) => child !== label).reduce((width, child) => width + child.getBoundingClientRect().width + gap, 0);
      const room = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - besideLabel - 1;
      const measureAction = textMeasurer(label);
      const measureDimmed = textMeasurer(label, '400');
      const width = ({ action, target, size }: CheckinButtonText): number =>
        measureAction(action) + (target ? PART_GAP + measureDimmed(target) : 0) + (size ? PART_GAP + measureDimmed(`· ${size}`) : 0);
      const index = forms.findIndex((form) => width(form) <= room);
      setShown(index === -1 ? forms.length - 1 : index);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(button);
    return () => observer.disconnect();
    // formsKey stands for forms, which is a new array on every render.
  }, [formsKey]);

  const { action, target, size } = forms[Math.min(shown, forms.length - 1)]!;
  return (
    <span ref={ref} className={styles.wording}>
      <span className={styles.action}>{action}</span>
      {target && <span className={styles.target}>{target}</span>}
      {size && <span className={styles.size}>· {size}</span>}
    </span>
  );
}
