import { ChevronDown, List, ListTree } from 'lucide-react';
import type { MenuEntry } from '../lib/actions';
import { Button } from '../ui/Button';
import { ActionDropdownMenu } from '../ui/menu/ActionDropdownMenu';
import { useFileListLayoutStore, type FileListLayout } from './fileListLayoutStore';
import styles from './FileListLayoutMenu.module.css';

const LAYOUTS: { value: FileListLayout; label: string; icon: typeof List }[] = [
  { value: 'list', label: 'List', icon: List },
  { value: 'tree', label: 'Tree', icon: ListTree },
];

/**
 * List or Tree: the one switch of every list of changed files, which switches them all. A menu rather than two
 * buttons side by side: the choice is made once and kept, so a second click costs less than the room two buttons take
 * in every filter bar. The button shows the current layout's icon, and its chevron says it opens a menu.
 */
export function FileListLayoutMenu() {
  const layout = useFileListLayoutStore((state) => state.layout);
  const setLayout = useFileListLayoutStore((state) => state.setLayout);
  const current = LAYOUTS.find((option) => option.value === layout) ?? LAYOUTS[0]!;
  const entries: MenuEntry[] = LAYOUTS.map((option) => ({
    id: option.value,
    label: option.label,
    icon: option.icon,
    checked: option.value === layout,
    run: () => setLayout(option.value),
  }));
  const CurrentIcon = current.icon;
  const label = `Show files as: ${current.label}`;
  return (
    <ActionDropdownMenu entries={entries}>
      <Button variant="ghost" size="small" className={styles.trigger} icon={<CurrentIcon size={14} />} aria-label={label} data-tip={label}>
        <ChevronDown size={11} className={styles.chevron} />
      </Button>
    </ActionDropdownMenu>
  );
}
