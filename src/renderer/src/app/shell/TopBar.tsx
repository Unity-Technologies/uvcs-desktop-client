import { Search } from 'lucide-react';
import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IncomingChip } from '../../features/incoming/IncomingChip';
import { Kbd } from '../../ui/Kbd';
import { AccountButton } from '../account/AccountButton';
import { useCommandPalette } from '../commands/commandPaletteStore';
import styles from './TopBar.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

export function TopBar() {
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);

  return (
    <div className={styles.topBar}>
      <div className={styles.branchControls}>
        <WorkingObjectButton />
        <IncomingChip />
      </div>
      <div className={styles.spacer} />
      <button
        className={styles.search}
        data-tip="Fuzzy search files, branches, labels, changesets, shelves, code reviews and commands"
        // Focus stays where it was, for the palette's field to take it and to give it back to on closing.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setCommandPaletteOpen(true)}
      >
        <Search size={13} />
        <span>Search everything</span>
        <Kbd keys={hotkey('commandPalette')} />
      </button>
      <AccountButton />
    </div>
  );
}
