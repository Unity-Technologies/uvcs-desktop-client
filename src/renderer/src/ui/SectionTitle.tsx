import type { ReactNode } from 'react';
import { classNames } from '../lib/classNames';
import styles from './SectionTitle.module.css';

interface SectionTitleProps {
  /** The heading level it takes in the outline around it. */
  as?: 'h2' | 'h3' | 'h4';
  /** How many items the section holds, shown quietly after its name; none when it says nothing worth showing. */
  count?: number;
  /** Where it sits in its layout (margins, padding); the look is the title's own. */
  className?: string;
  children: ReactNode;
}

/** A section's name as the app titles a section (Home's "Recent", What's New's groups): small, quiet, uppercase. */
export function SectionTitle({ as: Heading = 'h2', count, className, children }: SectionTitleProps) {
  return (
    <Heading className={classNames(styles.title, className)}>
      {children}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </Heading>
  );
}
