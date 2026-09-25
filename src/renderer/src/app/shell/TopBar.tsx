import { Search, TerminalSquare } from 'lucide-react';
import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IncomingChip } from '../../features/incoming/IncomingChip';
import { IconButton } from '../../ui/IconButton';
import { Kbd } from '../../ui/Kbd';
import { useCommandPalette } from '../commands/commandPaletteStore';
import { useCommandLogStore } from './commandLogStore';
import { ThemeSwitcher } from './ThemeSwitcher';
import styles from './TopBar.module.css';

export function TopBar() {
  const toggleCommandLog = useCommandLogStore((state) => state.toggle);
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);

  return (
    <div className={styles.topBar}>
      <WorkingObjectButton />
      <IncomingChip />
      <div className={styles.spacer} />
      <button className={styles.search} data-tip="Fuzzy search files, branches, labels, changesets, shelves, code reviews and commands" onClick={() => setCommandPaletteOpen(true)}>
        <Search size={13} />
        <span>Search everything</span>
        <Kbd keys="mod+k" />
      </button>
      <IconButton icon={<TerminalSquare size={15} />} label="Command log" shortcut="mod+shift+l" onClick={toggleCommandLog} />
      <ThemeSwitcher />
    </div>
  );
}
