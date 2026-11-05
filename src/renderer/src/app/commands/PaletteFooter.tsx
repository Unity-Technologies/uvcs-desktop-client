import { Kbd } from '../../ui/Kbd';
import type { Place } from '@shared/domain/place';
import { offeredPrefixes } from './paletteScope';
import styles from './CommandPalette.module.css';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';

/** The keys that drive the palette, and the prefixes that narrow the search where it's open (`offeredPrefixes`). */
export function PaletteFooter({ place }: { place: Place | null }) {
  return (
    <div className={styles.footer}>
      <span className={styles.hint}>
        {hotkeys('paletteMove').map((key) => (
          <Kbd key={key} keys={key} />
        ))}{' '}
        move
      </span>
      <span className={styles.hint}>
        <Kbd keys={hotkey('paletteOpen')} /> open
      </span>
      <span className={styles.hint}>
        <Kbd keys={hotkey('rowActions')} /> actions
      </span>
      <span className={styles.scopes}>
        {offeredPrefixes(place).map(({ prefix, hint }) => (
          <span key={prefix} className={styles.hint}>
            <Kbd keys={prefix} /> {hint}
          </span>
        ))}
      </span>
    </div>
  );
}
