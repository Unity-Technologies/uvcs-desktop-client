import { Fragment } from 'react';
import { isMac } from '../../lib/platform';
import { SHORTCUTS, type ShortcutArea } from '../../lib/shortcutRegistry';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Kbd } from '../../ui/Kbd';
import { VIEWS } from '../navigation/viewRegistry';
import { shortcutSheet } from './shortcutSheet';
import styles from './ShortcutsDialog.module.css';

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

function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Keyboard shortcuts" width={820} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.columns}>
        {shortcutSheet(VIEWS, Object.values(SHORTCUTS), isMac).map(([area, rows]) => (
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
