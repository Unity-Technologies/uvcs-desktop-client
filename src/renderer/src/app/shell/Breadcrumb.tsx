import { ChevronLeft } from 'lucide-react';
import styles from './Breadcrumb.module.css';

interface BreadcrumbProps {
  /** Where back goes, by its name ("Changesets", "Changeset 10"); none where there's nothing to go back to. */
  back?: { label: string; onClick: () => void };
  current: string;
}

/** "‹ Where it came from / What it shows": a page's way back and its title, in a workspace window or a page window. */
export function Breadcrumb({ back, current }: BreadcrumbProps) {
  return (
    <>
      {back && (
        <>
          <button className={styles.back} onClick={back.onClick}>
            <ChevronLeft size={15} />
            {back.label}
          </button>
          <span className={styles.separator}>/</span>
        </>
      )}
      <span className={styles.current}>{current}</span>
    </>
  );
}
