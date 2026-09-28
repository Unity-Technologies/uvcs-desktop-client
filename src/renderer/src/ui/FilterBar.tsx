import type { ReactNode } from 'react';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  /** The text filter (`FilterField`). */
  text?: ReactNode;
  /** Whose rows (`PeopleFilter`). */
  people?: ReactNode;
  /** How far back (`SincePicker`). */
  time?: ReactNode;
  /** What kinds or statuses (chips, the branches picker). */
  kinds?: ReactNode;
  /** How the list shows (layout, what the view draws), at the end of the bar. */
  view?: ReactNode;
}

/**
 * Every view's filters in the same order, so each one is where the last view had it: text, people, time, kinds, then
 * the view's own options at the end. A view leaves out what it doesn't have.
 */
export function FilterBar({ text, people, time, kinds, view }: FilterBarProps) {
  return (
    <div className={styles.bar}>
      {text}
      {people}
      {time}
      {kinds}
      {view && <div className={styles.view}>{view}</div>}
    </div>
  );
}
