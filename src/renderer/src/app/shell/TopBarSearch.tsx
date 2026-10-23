import { Search } from 'lucide-react';
import { Kbd } from '../../ui/Kbd';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommandPalette } from '../commands/commandPaletteStore';
import styles from './TopBarSearch.module.css';

/** The top bar's "Search everything", opening the command palette. */
export function TopBarSearch({ tip }: { tip: string }) {
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);
  return (
    <button
      className={styles.search}
      data-tip={tip}
      // Focus stays where it was, for the palette's field to take it and to give it back to on closing.
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setCommandPaletteOpen(true)}
    >
      <Search size={13} />
      <span>Search everything</span>
      <Kbd keys={hotkey('commandPalette')} />
    </button>
  );
}
