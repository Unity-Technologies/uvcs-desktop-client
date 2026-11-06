import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { segmentAfterKey } from './segmentKeys';
import styles from './Tabs.module.css';

interface Tab<Value extends string> {
  value: Value;
  label: ReactNode;
  icon?: ReactNode;
  /** A count beside the label: the comments, the files changed. */
  count?: number;
}

interface TabsProps<Value extends string> {
  value: Value;
  tabs: Tab<Value>[];
  onChange: (value: Value) => void;
  label: string;
  /** Each tab's panel is `${idPrefix}-<value>`, which the tab controls. */
  idPrefix: string;
}

/**
 * A page's tabs, underlined as a page's sections are: one Tab stop (the selected tab), ← → move between them. The
 * panels are the page's own, each a `role="tabpanel"` with the id the tab names (`tabPanelId`).
 */
export function Tabs<Value extends string>({ value, tabs, onChange, label, idPrefix }: TabsProps<Value>) {
  const listRef = useRef<HTMLDivElement>(null);

  const moveWithArrows = (event: KeyboardEvent): void => {
    const next = segmentAfterKey(
      tabs.map((tab) => tab.value),
      value,
      event.key,
    );
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  };

  return (
    <div ref={listRef} className={styles.tabs} role="tablist" aria-label={label} onKeyDown={moveWithArrows}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          id={`${idPrefix}-tab-${tab.value}`}
          aria-selected={tab.value === value}
          aria-controls={tabPanelId(idPrefix, tab.value)}
          tabIndex={tab.value === value ? 0 : -1}
          data-value={tab.value}
          className={styles.tab}
          onClick={() => onChange(tab.value)}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && <span className={styles.count}>{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function tabPanelId(idPrefix: string, value: string): string {
  return `${idPrefix}-${value}`;
}
