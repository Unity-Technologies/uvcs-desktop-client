import { AppWindow, Plus, Sparkles, SquareTerminal, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { AUTO_APP, type ExternalApp } from '@shared/domain/externalApps';
import { chooseEditor, preferEditor, preferTerminal, removeCustomEditor } from '../../components/externalApps/externalAppOperations';
import { appIcon } from '../../components/externalApps/appIcon';
import { useExternalApps } from '../../components/externalApps/externalApps';
import { Button } from '../../ui/Button';
import { automaticAppDescription, AUTOMATIC_EDITOR_RULE, AUTOMATIC_TERMINAL_RULE, isAutomatic } from './automaticApp';
import { SettingsChoice } from './SettingsChoice';
import { useSettings } from './useSettings';
import styles from './SettingsDialog.module.css';

/** The editor and terminal "Open in…" uses; "Open with" offers every one of them anyway. */
export function AppsPane() {
  const apps = useExternalApps();
  const { editor, terminal } = useSettings();
  const automaticEditor = isAutomatic(editor, apps.editors);
  const automaticTerminal = isAutomatic(terminal, apps.terminals);
  const customChosen = apps.editors.find((app) => app.id === editor && app.origin === 'custom');

  return (
    <>
      <p className={styles.note}>Files, folders and the workspace open in these apps from their menus. Open with offers every app found.</p>
      <section className={styles.section}>
        <h2 className={styles.heading}>Open files and folders in</h2>
        <AppChoices
          label="Editor"
          apps={apps.editors}
          chosenId={automaticEditor ? null : editor}
          automaticDescription={automaticAppDescription(automaticEditor ? nameOf(apps.editors, apps.editorId) : undefined, AUTOMATIC_EDITOR_RULE)}
          automaticTip={AUTOMATIC_EDITOR_RULE}
          icon={<AppWindow size={18} />}
          onChoose={(id) => void preferEditor(id)}
        />
        <div className={styles.folderRow}>
          <Button size="small" icon={<Plus size={13} />} onClick={() => void addEditorAndPick()}>
            Add another app…
          </Button>
          {customChosen && (
            <Button size="small" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void removeCustomEditor(customChosen.id)}>
              Remove {customChosen.name}
            </Button>
          )}
        </div>
      </section>
      <section className={styles.section}>
        <h2 className={styles.heading}>Open terminals in</h2>
        <AppChoices
          label="Terminal"
          apps={apps.terminals}
          chosenId={automaticTerminal ? null : terminal}
          automaticDescription={automaticAppDescription(automaticTerminal ? nameOf(apps.terminals, apps.terminalId) : undefined, AUTOMATIC_TERMINAL_RULE)}
          automaticTip={AUTOMATIC_TERMINAL_RULE}
          icon={<SquareTerminal size={18} />}
          onChoose={(id) => void preferTerminal(id)}
        />
      </section>
    </>
  );
}

interface AppChoicesProps {
  label: string;
  apps: ExternalApp[];
  /** Null while "Automatic" is chosen. */
  chosenId: string | null;
  automaticDescription: string;
  automaticTip: string;
  /** Shown for an app the OS gave no icon of its own. */
  icon: ReactNode;
  onChoose: (id: string) => void;
}

function AppChoices({ label, apps, chosenId, automaticDescription, automaticTip, icon, onChoose }: AppChoicesProps) {
  return (
    <div className={styles.choices} role="radiogroup" aria-label={label}>
      <SettingsChoice
        icon={<Sparkles size={18} />}
        label="Automatic"
        description={automaticDescription}
        tip={automaticTip}
        selected={chosenId === null}
        onSelect={() => onChoose(AUTO_APP)}
      />
      {apps.map((app) => {
        const AppIcon = appIcon(app);
        return (
          <SettingsChoice
            key={app.id}
            icon={AppIcon ? <AppIcon size={18} /> : icon}
            label={app.name}
            description={app.location}
            tip={app.location}
            selected={app.id === chosenId}
            onSelect={() => onChoose(app.id)}
          />
        );
      })}
    </div>
  );
}

/** Adds an app the user picks and makes it the one files open in. */
async function addEditorAndPick(): Promise<void> {
  const id = await chooseEditor();
  if (id) await preferEditor(id);
}

const nameOf = (apps: ExternalApp[], id: string | null): string | undefined => apps.find((app) => app.id === id)?.name;
