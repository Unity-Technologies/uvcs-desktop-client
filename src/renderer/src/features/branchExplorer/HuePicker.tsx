import { HueDot } from './HueDot';
import { BRANCH_HUES } from './model/branchHue';
import styles from './HuePicker.module.css';

/** The colors the graph draws with, as a row of swatches to pick one from: a format rule's, a person's. */
export function HuePicker({ hue, onChange }: { hue: number | null; onChange: (hue: number) => void }) {
  return (
    <div className={styles.swatches} role="radiogroup" aria-label="Color">
      {BRANCH_HUES.map((option, index) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={hue === option}
          aria-label={`Color ${index + 1}`}
          className={styles.swatch}
          onClick={() => onChange(option)}
        >
          <HueDot hue={option} size={16} />
        </button>
      ))}
    </div>
  );
}
