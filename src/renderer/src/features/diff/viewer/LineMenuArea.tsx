import type { MouseEvent, ReactElement } from 'react';
import type { MenuEntry } from '../../../lib/actions';
import { ActionContextMenu } from '../../../ui/menu/ActionContextMenu';

interface LineMenuAreaProps {
  /** The lines' menu (`useLineTools`); where it's off, the code keeps the system's menu (an editor's: cut, paste). */
  menu: { enabled: boolean; onContextMenu: (event: MouseEvent) => void; entries: () => MenuEntry[] };
  children: ReactElement;
}

/** The code's area whose right-click opens the lines' menu. */
export function LineMenuArea({ menu, children }: LineMenuAreaProps) {
  if (!menu.enabled) return children;
  return (
    <ActionContextMenu entries={menu.entries} onContextMenu={menu.onContextMenu}>
      {children}
    </ActionContextMenu>
  );
}
