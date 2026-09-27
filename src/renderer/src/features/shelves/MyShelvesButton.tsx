import * as Popover from '@radix-ui/react-popover';
import { Archive, Users } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { hotkey } from '../../lib/shortcutRegistry';
import { sincePresetLabel } from '../../lib/sincePresets';
import { Button } from '../../ui/Button';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { myShelvesLabel } from './myShelves';
import { MyShelvesList } from './MyShelvesList';
import { SHELVES_SINCE, type ShelvesScope } from './shelvesScope';
import { useMyShelves } from './useMyShelves';
import styles from './MyShelvesButton.module.css';

/**
 * "3 shelves" in the Changes header: the user's recent shelves (changes shelved away, left by a switch, or kept as a
 * copy), to apply without leaving Changes, and everyone's a click away. Shown only while the user has some.
 */
export function MyShelvesButton() {
  const workspacePath = useWorkspacePath();
  const { data: shelves = [] } = useMyShelves();
  const [open, setOpen] = useState(false);
  // Every opening starts on the user's own, which the button counts: the list never opens on something else.
  const [scope, setScope] = useState<ShelvesScope>('mine');
  const returnFocus = useReturnFocus(open);
  const openOn = useCallback((opened: ShelvesScope) => {
    setScope(opened);
    setOpen(true);
  }, []);
  useShelvesCommands(shelves.length > 0, openOn);

  // Kept while open, so deleting the last one doesn't take the list from under the pointer.
  if (shelves.length === 0 && !open) return null;
  return (
    <Popover.Root open={open} onOpenChange={(opening) => (opening ? openOn('mine') : setOpen(false))}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          icon={<Archive size={14} />}
          className={styles.trigger}
          data-tip={`Your shelves from the ${sincePresetLabel(SHELVES_SINCE).toLowerCase()}`}
          data-tip-shortcut={hotkey('myShelves')}
        >
          {myShelvesLabel(shelves.length)}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="end" sideOffset={6} {...returnFocus}>
          <MyShelvesList workspacePath={workspacePath} scope={scope} onScopeChange={setScope} recent={shelves} onDone={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function useShelvesCommands(available: boolean, openOn: (scope: ShelvesScope) => void): void {
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'shelves.mine',
        group: 'Changes',
        label: 'Your shelves…',
        icon: Archive,
        keywords: ['apply', 'restore', 'stash'],
        shortcut: hotkey('myShelves'),
        disabled: !available,
        run: () => openOn('mine'),
      },
      {
        id: 'shelves.everyone',
        group: 'Changes',
        label: "Everyone's shelves…",
        icon: Users,
        keywords: ['apply', 'stash', 'team', 'others'],
        run: () => openOn('everyone'),
      },
    ],
    [available, openOn],
  );
  useCommands(commands);
}
