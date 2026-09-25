import { Kbd } from '../../ui/Kbd';
import { SCOPE_PREFIXES } from './paletteScope';
import styles from './CommandPalette.module.css';

/** The keys that drive the palette, and the prefixes that narrow the search (without a workspace, only commands can be searched). */
export function PaletteFooter({ inWorkspace }: { inWorkspace: boolean }) {
  return (
    <div className={styles.footer}>
      <span className={styles.hint}>
        <Kbd keys="up" />
        <Kbd keys="down" /> move
      </span>
      <span className={styles.hint}>
        <Kbd keys="enter" /> open
      </span>
      <span className={styles.hint}>
        <Kbd keys="tab" /> actions
      </span>
      <span className={styles.scopes}>
        {SCOPE_PREFIXES.filter(({ scope }) => inWorkspace || scope === 'commands').map(({ prefix, hint }) => (
          <span key={prefix} className={styles.hint}>
            <Kbd keys={prefix} /> {hint}
          </span>
        ))}
      </span>
    </div>
  );
}
