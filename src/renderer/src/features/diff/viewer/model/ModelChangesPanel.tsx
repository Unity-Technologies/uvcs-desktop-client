// "What changed": the model diff's list of changes as Unity will take them (`modelChanges`, `changeRows`). Risks
// first, with why they matter; a row picked frames and lights up what it is about on both sides, picked again lets
// go. It starts folded to its title, with its count and risks, so the model has the stage, and stays as the user
// leaves it (`modelChangesOpen`). Open beside a wide stage it is a column of its own, so it never covers the model; on
// a narrow one, or folded, it floats at the stage's top right.

import { ChevronDown, ChevronRight, CircleCheck, TriangleAlert } from 'lucide-react';
import type { ChangeRow } from './modelChangeWords';
import styles from './ModelChangesPanel.module.css';

interface ModelChangesPanelProps {
  rows: ChangeRow[];
  /** The row picked, or one of its items (`<row id>/<index>`). */
  picked: string | null;
  onPick: (id: string | null, row: ChangeRow, item?: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A column beside the stage, rather than floating over it. */
  docked: boolean;
  /** Floating, it sits below the pills a mode shows at the stage's top (the onion's blend, the differences' tolerance). */
  pillRows: 0 | 1 | 2;
}

export function ModelChangesPanel({ rows, picked, onPick, open, onOpenChange, docked, pillRows }: ModelChangesPanelProps) {
  const risks = rows.filter((row) => row.tone === 'risk').length;
  const toggle = (id: string, row: ChangeRow, item?: number): void => onPick(picked === id ? null : id, row, item);

  return (
    <section className={styles.panel} data-docked={docked || undefined} data-pill-rows={docked ? undefined : pillRows || undefined} data-no-pan aria-label="What changed">
      <button type="button" className={styles.header} aria-expanded={open} onClick={() => onOpenChange(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className={styles.title}>What changed</span>
        {risks > 0 && (
          <span className={styles.riskCount} data-tip={`${risks} may break something in Unity`}>
            <TriangleAlert size={12} /> {risks}
          </span>
        )}
        <span className={styles.count}>{rows.length}</span>
      </button>
      {open && (
        <div className={styles.body}>
          {rows.length === 0 ? (
            <p className={styles.nothing}>
              <CircleCheck size={14} /> Nothing Unity imports changed
            </p>
          ) : (
            <ul className={styles.rows}>
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.row} data-tone={row.tone} aria-pressed={picked === row.id} onClick={() => toggle(row.id, row)}>
                    <span className={styles.mark}>{row.tone === 'risk' ? <TriangleAlert size={13} /> : <span className={styles.dot} />}</span>
                    <span className={styles.words}>
                      <span className={styles.rowTitle}>{row.title}</span>
                      {row.detail && <span className={styles.detail}>{row.detail}</span>}
                    </span>
                  </button>
                  {row.items && (
                    <ul className={styles.items}>
                      {row.items.map((item, index) => (
                        <li key={`${row.id}/${index}`}>
                          <button type="button" className={styles.item} aria-pressed={picked === `${row.id}/${index}`} onClick={() => toggle(`${row.id}/${index}`, row, index)}>
                            {item.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
