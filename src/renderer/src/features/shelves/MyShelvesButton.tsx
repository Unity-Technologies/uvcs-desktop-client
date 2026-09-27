import * as Popover from '@radix-ui/react-popover';
import { Archive } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCommands, type Command } from '../../app/commands/commandStore';
import { useWorkspacePath } from '../../app/workspace/useWorkspace';
import { hotkey } from '../../lib/shortcutRegistry';
import { sincePresetLabel } from '../../lib/sincePresets';
import { Button } from '../../ui/Button';
import { useReturnFocus } from '../../ui/useReturnFocus';
import { myShelvesLabel } from './myShelves';
import { MyShelvesList } from './MyShelvesList';
import { MY_SHELVES_SINCE, useMyShelves } from './useMyShelves';
import styles from './MyShelvesButton.module.css';

/**
 * "3 shelves" in the Changes header: the user's recent shelves (changes shelved away, left by a switch, or kept as a
 * copy), to apply without leaving Changes. Shown only while there are some.
 */
export function MyShelvesButton() {
  const workspacePath = useWorkspacePath();
  const { data: shelves = [] } = useMyShelves();
  const [open, setOpen] = useState(false);
  const returnFocus = useReturnFocus(open);
  useMyShelvesCommand(shelves.length > 0, setOpen);

  // Kept while open, so deleting the last one doesn't take the list from under the pointer.
  if (shelves.length === 0 && !open) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          icon={<Archive size={14} />}
          className={styles.trigger}
          data-tip={`Your shelves from the ${sincePresetLabel(MY_SHELVES_SINCE).toLowerCase()}`}
          data-tip-shortcut={hotkey('myShelves')}
        >
          {myShelvesLabel(shelves.length)}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className={styles.popover} align="end" sideOffset={6} {...returnFocus}>
          <MyShelvesList workspacePath={workspacePath} recent={shelves} onDone={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function useMyShelvesCommand(available: boolean, setOpen: (open: boolean) => void): void {
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
        run: () => setOpen(true),
      },
    ],
    [available, setOpen],
  );
  useCommands(commands);
}
