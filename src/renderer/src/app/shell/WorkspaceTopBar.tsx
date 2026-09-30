import { Search } from 'lucide-react';
import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IncomingChip } from '../../features/incoming/IncomingChip';
import { Kbd } from '../../ui/Kbd';
import { AccountButton } from '../account/AccountButton';
import { useCommandPalette } from '../commands/commandPaletteStore';
import { TopBar } from './TopBar';
import styles from './WorkspaceTopBar.module.css';
import { hotkey } from '../../lib/shortcutRegistry';

/** A workspace's top bar: its branch (and what's incoming) after the brand, the search and the account at the end. */
export function WorkspaceTopBar() {
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);

  const end = (
    <>
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
    </>
  );

  return (
    <TopBar end={end}>
      <div className={styles.branchControls}>
        <WorkingObjectButton />
        <IncomingChip />
      </div>
    </TopBar>
  );
}
