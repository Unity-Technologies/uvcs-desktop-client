import { Fragment } from 'react';
import { isMac } from '../../lib/platform';
import { SHORTCUT_AREAS, SHORTCUTS, shortcutKeys, type ShortcutArea } from '../../lib/shortcutRegistry';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Kbd } from '../../ui/Kbd';
import { VIEWS } from '../navigation/viewRegistry';
import styles from './ShortcutsDialog.module.css';

interface SheetRow {
  label: string;
  keys: readonly string[];
}

let sheetOpen = false;

/** Shows every shortcut of the app; pressing its keys again while it's open does nothing. */
export function openShortcutsDialog(): void {
  if (sheetOpen) return;
  sheetOpen = true;
  openDialog((close) => (
    <ShortcutsDialog
      onClose={() => {
        sheetOpen = false;
        close();
      }}
    />
  ));
}

/** The rows of each area: the views in sidebar order, then the registry's shortcuts (contextual ones included). */
function sheetAreas(): [ShortcutArea, SheetRow[]][] {
  const rows = new Map<ShortcutArea, SheetRow[]>(SHORTCUT_AREAS.map((area) => [area, []]));
  rows.set(
    'Go to',
    VIEWS.map((view) => ({ label: view.label, keys: [view.shortcut] })),
  );
  for (const shortcut of Object.values(SHORTCUTS)) {
    const keys = shortcutKeys(shortcut, isMac);
    if (keys.length > 0) rows.get(shortcut.area)!.push({ label: shortcut.label, keys });
  }
  return [...rows].filter(([, areaRows]) => areaRows.length > 0);
}

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" width={820} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.columns}>
        {sheetAreas().map(([area, rows]) => (
          <section key={area} aria-labelledby={headingId(area)}>
            <h2 id={headingId(area)} className={styles.heading}>
              {area}
            </h2>
            <dl className={styles.list}>
              {rows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <dt>{row.label}</dt>
                  <dd className={styles.keys}>
                    {row.keys.map((key, index) => (
                      <Fragment key={key}>
                        {index > 0 && <span className={styles.or}>/</span>}
                        <Kbd keys={key} />
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

function headingId(area: ShortcutArea): string {
  return `shortcuts-${area.toLowerCase().replaceAll(' ', '-')}`;
}
