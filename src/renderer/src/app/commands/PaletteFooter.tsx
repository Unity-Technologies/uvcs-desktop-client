import { classNames } from '../../lib/classNames';
import { Kbd } from '../../ui/Kbd';
import styles from './CommandPalette.module.css';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';

/** The keys that drive the palette; the scope's too where it has scope chips (`scopeChipsFor`). */
export function PaletteFooter({ changesScope }: { changesScope: boolean }) {
  return (
    <div className={styles.footer}>
      <KeysHint keys={hotkeys('paletteMove')} label="move" />
      <KeysHint keys={[hotkey('paletteOpen')]} label="open" />
      <KeysHint keys={[hotkey('rowActions')]} label="actions" />
      {changesScope && <KeysHint keys={hotkeys('paletteScope')} label="change scope" className={styles.scopeHint} />}
    </div>
  );
}

function KeysHint({ keys, label, className }: { keys: readonly string[]; label: string; className?: string }) {
  return (
    <span className={classNames(styles.hint, className)}>
      {keys.map((key) => (
        <Kbd key={key} keys={key} />
      ))}{' '}
      {label}
    </span>
  );
}
