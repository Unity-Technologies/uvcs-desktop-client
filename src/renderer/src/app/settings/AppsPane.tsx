import { Trash2 } from 'lucide-react';
import { chooseEditor, preferEditor, preferTerminal, removeCustomEditor } from '../../components/externalApps/externalAppOperations';
import { useExternalApps } from '../../components/externalApps/externalApps';
import { Button } from '../../ui/Button';
import { AppPicker } from './AppPicker';
import { AUTOMATIC_EDITOR_RULE, AUTOMATIC_TERMINAL_RULE } from './automaticApp';
import { SettingsGroup } from './SettingsGroup';
import { useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** The editor and terminal files and folders open in; "Open with" offers every app found anyway. */
export function AppsPane() {
  const apps = useExternalApps();
  const { editor, terminal } = useSettings();
  const customChosen = apps.editors.find((app) => app.id === editor && app.origin === 'custom');

  return (
    <>
      <SettingsGroup title="Editor">
        <p className={styles.note}>Files and folders open in it from their menus. Open with offers every app found.</p>
        <AppPicker
          label="Editor"
          apps={apps.editors}
          choice={editor}
          usedId={apps.editorId}
          automaticRule={AUTOMATIC_EDITOR_RULE}
          offersSystem
          onChoose={(choice) => void preferEditor(choice)}
          onAdd={() => void addEditorAndPick()}
        />
        {customChosen && (
          <div className={styles.folderRow}>
            <Button size="small" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void removeCustomEditor(customChosen.id)}>
              Remove {customChosen.name}
            </Button>
          </div>
        )}
      </SettingsGroup>
      <SettingsGroup title="Terminal">
        <p className={styles.note}>Folders and the workspace open in it from their menus.</p>
        <AppPicker
          label="Terminal"
          apps={apps.terminals}
          choice={terminal}
          usedId={apps.terminalId}
          automaticRule={AUTOMATIC_TERMINAL_RULE}
          onChoose={(choice) => void preferTerminal(choice)}
        />
      </SettingsGroup>
    </>
  );
}

/** Adds an app the user picks and makes it the one files open in. */
async function addEditorAndPick(): Promise<void> {
  const id = await chooseEditor();
  if (id) await preferEditor(id);
}
