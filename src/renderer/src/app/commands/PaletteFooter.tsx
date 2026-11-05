import { Kbd } from '../../ui/Kbd';
import type { Place } from '@shared/domain/place';
import { offeredPrefixes, type ScopePrefix } from './paletteScope';
import styles from './CommandPalette.module.css';
import { hotkey, hotkeys } from '../../lib/shortcutRegistry';

/** The keys that drive the palette, and the prefixes that narrow the search where it's open (`offeredPrefixes`). */
export function PaletteFooter({ place }: { place: Place | null }) {
  const { own, shared } = offeredPrefixes(place);
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
      <PrefixHints prefixes={own} className={styles.ownScopes} />
      <PrefixHints prefixes={shared} className={styles.sharedScopes} />
    </div>
  );
}

/** Prefixes as typed, each with the section it narrows to. */
function PrefixHints({ prefixes, className }: { prefixes: readonly ScopePrefix[]; className: string }) {
  if (prefixes.length === 0) return null;
  return (
    <span className={className}>
      {prefixes.map(({ prefix, hint }) => (
        <span key={prefix} className={styles.hint}>
          <Kbd keys={prefix} typed /> {hint}
        </span>
      ))}
    </span>
  );
}
