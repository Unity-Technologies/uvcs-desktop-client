import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/dialog/Dialog';
import { openDialog } from '../../ui/dialog/dialogStore';
import { Kbd } from '../../ui/Kbd';
import { allCommands, type Command } from './commandStore';
import styles from './ShortcutsDialog.module.css';

export function openShortcutsDialog(): void {
  openDialog((close) => <ShortcutsDialog onClose={close} />);
}

/** Every command that currently has a keyboard shortcut, grouped like the command palette. */
function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const groups = new Map<string, Command[]>();
  for (const command of allCommands().filter((candidate) => candidate.shortcut)) {
    groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  }

  return (
    <Dialog title="Keyboard shortcuts" width={560} onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className={styles.columns}>
        {[...groups].map(([group, commands]) => (
          <section key={group}>
            <h2 className={styles.heading}>{group}</h2>
            {commands.map((command) => (
              <div key={command.id} className={styles.row}>
                <span>{command.label}</span>
                <Kbd keys={command.shortcut!} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </Dialog>
  );
}
