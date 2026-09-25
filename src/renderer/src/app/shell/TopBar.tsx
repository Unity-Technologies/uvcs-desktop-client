import { Search } from 'lucide-react';
import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IncomingChip } from '../../features/incoming/IncomingChip';
import { Kbd } from '../../ui/Kbd';
import { AccountButton } from '../account/AccountButton';
import { useCommandPalette } from '../commands/commandPaletteStore';
import styles from './TopBar.module.css';

export function TopBar() {
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);

  return (
    <div className={styles.topBar}>
      <div className={styles.branchControls}>
        <WorkingObjectButton />
        <IncomingChip />
      </div>
      <div className={styles.spacer} />
      <button className={styles.search} data-tip="Fuzzy search files, branches, labels, changesets, shelves, code reviews and commands" onClick={() => setCommandPaletteOpen(true)}>
        <Search size={13} />
        <span>Search everything</span>
        <Kbd keys="mod+k" />
      </button>
      <AccountButton />
    </div>
  );
}
