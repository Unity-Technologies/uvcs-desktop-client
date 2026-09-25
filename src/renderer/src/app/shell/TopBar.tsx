import { ArrowDownToLine, Search, TerminalSquare } from 'lucide-react';
import { WorkingObjectButton } from '../../features/branches/WorkingObjectButton';
import { IconButton } from '../../ui/IconButton';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/Kbd';
import { useCommandPalette } from '../commands/commandPaletteStore';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { useCommandLogStore } from './commandLogStore';
import { updateWorkspace } from './workspaceOperations';
import styles from './TopBar.module.css';

export function TopBar() {
  const workspacePath = useWorkspacePath();
  const toggleCommandLog = useCommandLogStore((state) => state.toggle);
  const setCommandPaletteOpen = useCommandPalette((state) => state.setOpen);

  return (
    <div className={styles.topBar}>
      <WorkingObjectButton />
      <div className={styles.spacer} />
      <button className={styles.search} data-tip="Fuzzy search files, branches, labels, changesets, shelves, code reviews and commands" onClick={() => setCommandPaletteOpen(true)}>
        <Search size={13} />
        <span>Search everything</span>
        <Kbd keys="mod+k" />
      </button>
      <IconButton icon={<TerminalSquare size={15} />} label="Command log" shortcut="mod+shift+l" onClick={toggleCommandLog} />
      <Button icon={<ArrowDownToLine size={14} />} onClick={() => void updateWorkspace(workspacePath)}>
        Update
      </Button>
    </div>
  );
}
