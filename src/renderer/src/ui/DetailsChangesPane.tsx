import { useRef, type CSSProperties, type ReactNode } from 'react';
import { DetailsDisclosure } from './DetailsDisclosure';
import { CHANGES_HEIGHT, useDetailsLayoutStore } from './detailsLayoutStore';
import { ResizeHandle } from './ResizeHandle';
import styles from './DetailsChangesPane.module.css';

interface DetailsChangesPaneProps {
  /** e.g. "Changes" or "12 files changed". */
  title: ReactNode;
  /** A small control at the right of the title. */
  action?: ReactNode;
  /** The list is shown: the pane gets a splitter and fills the space left, at least as tall as it was sized. */
  expanded: boolean;
  /** Given, the title is a disclosure that shows and hides what the pane lists. */
  disclosure?: { open: boolean; toggle: () => void };
  children: ReactNode;
}

/** The pane at the bottom of a details panel listing what the object changed, resizable once the list shows. */
export function DetailsChangesPane({ title, action, expanded, disclosure, children }: DetailsChangesPaneProps) {
  const { changesHeight, set } = useDetailsLayoutStore();
  const paneRef = useRef<HTMLElement>(null);

  return (
    <section ref={paneRef} className={styles.changes} data-expanded={expanded} style={{ '--changes-height': `${changesHeight}px` } as CSSProperties}>
      {expanded && (
        <ResizeHandle
          size={changesHeight}
          min={CHANGES_HEIGHT.min}
          max={CHANGES_HEIGHT.max}
          measure={() => paneRef.current?.offsetHeight ?? changesHeight}
          onResize={(height) => set({ changesHeight: height })}
        />
      )}
      <div className={styles.header}>
        <h3 className={styles.title}>
          {disclosure ? (
            <DetailsDisclosure open={disclosure.open} onToggle={disclosure.toggle} asTitle>
              {title}
            </DetailsDisclosure>
          ) : (
            title
          )}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
