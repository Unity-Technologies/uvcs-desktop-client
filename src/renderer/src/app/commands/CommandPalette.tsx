import { Command as Cmdk } from 'cmdk';
import { useShortcut } from '../../lib/useShortcut';
import { Kbd } from '../../ui/Kbd';
import { useCommandPalette } from './commandPaletteStore';
import { useCommandStore, type Command } from './commandStore';
import styles from './CommandPalette.module.css';

export function CommandPalette() {
  const { isOpen: open, setOpen, toggle } = useCommandPalette();
  const commandsByOwner = useCommandStore((state) => state.commandsByOwner);

  useShortcut('mod+k', toggle);
  useShortcut('mod+shift+p', () => setOpen(true));

  if (!open) return null;

  const groups = groupCommands([...commandsByOwner.values()].flat().filter((command) => !command.disabled));
  const run = (command: Command): void => {
    setOpen(false);
    command.run();
  };

  return (
    <div className={styles.overlay} onMouseDown={() => setOpen(false)}>
      <Cmdk
        className={styles.palette}
        label="Command palette"
        loop
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        <Cmdk.Input className={styles.input} placeholder="Type a command or search…" autoFocus />
        <Cmdk.List className={styles.list}>
          <Cmdk.Empty className={styles.empty}>No matching commands.</Cmdk.Empty>
          {[...groups].map(([group, commands]) => (
            <Cmdk.Group key={group} heading={group} className={styles.group}>
              {commands.map((command) => {
                const Icon = command.icon;
                return (
                  <Cmdk.Item
                    key={command.id}
                    value={`${group} ${command.label} ${command.id}`}
                    keywords={command.keywords}
                    className={styles.item}
                    onSelect={() => run(command)}
                  >
                    <span className={styles.icon}>{Icon && <Icon size={15} />}</span>
                    <span className={styles.label}>{command.label}</span>
                    {command.shortcut && <Kbd keys={command.shortcut} />}
                  </Cmdk.Item>
                );
              })}
            </Cmdk.Group>
          ))}
        </Cmdk.List>
      </Cmdk>
    </div>
  );
}

function groupCommands(commands: Command[]): Map<string, Command[]> {
  const groups = new Map<string, Command[]>();
  for (const command of commands) groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  return groups;
}
