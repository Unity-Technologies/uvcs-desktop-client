import { AppWindow, FolderOpen } from 'lucide-react';
import { AUTO_APP, SYSTEM_APP, type ExternalApp } from '@shared/domain/externalApps';
import { appIcon } from '../../components/externalApps/appIcon';
import { SEPARATOR, tidyMenu, type Icon, type MenuEntry } from '../../lib/actions';
import { AUTOMATIC_CHOICE_ICON, automaticAppDescription, isAutomatic } from './automaticApp';

/** One setting's apps, as a drop-down: "Automatic", every app found, and for the editor each file's default app. */
export interface AppPickerChoices {
  apps: ExternalApp[];
  /** The setting: `auto`, `system` or an app id. */
  choice: string;
  /** The app the setting resolves to now (what "Automatic" uses), if any. */
  usedId: string | null;
  /** What "Automatic" picks, while it picks none. */
  automaticRule: string;
  /** Offers opening each file with its default app (the editor). */
  offersSystem?: boolean;
  onChoose: (choice: string) => void;
  /** Offers adding another app (the editor). */
  onAdd?: () => void;
}

/** What the drop-down's button shows: the choice, a line about it, and its icon. */
export interface PickedApp {
  label: string;
  description: string;
  icon: Icon | undefined;
}

export const SYSTEM_APP_LABEL = "Each file's default app";

/** The choice made, as the button shows it: an app with where it is, or "Automatic" with the app it uses. */
export function pickedApp({ apps, choice, usedId, automaticRule, offersSystem }: AppPickerChoices): PickedApp {
  if (offersSystem && choice === SYSTEM_APP) return { label: SYSTEM_APP_LABEL, description: 'As the OS opens it', icon: AppWindow };
  const used = apps.find((app) => app.id === usedId);
  if (isAutomatic(choice, apps)) return { label: 'Automatic', description: automaticAppDescription(used?.name, automaticRule), icon: (used && appIcon(used)) ?? AUTOMATIC_CHOICE_ICON };
  return { label: used?.name ?? choice, description: used?.location ?? '', icon: (used && appIcon(used)) ?? AppWindow };
}

/** The drop-down's entries, the choice made checked. */
export function appPickerEntries({ apps, choice, usedId, offersSystem, onChoose, onAdd }: AppPickerChoices): MenuEntry[] {
  const automatic = isAutomatic(choice, apps) && !(offersSystem && choice === SYSTEM_APP);
  const used = apps.find((app) => app.id === usedId);
  return tidyMenu([
    { id: AUTO_APP, label: used ? `Automatic (${used.name})` : 'Automatic', icon: AUTOMATIC_CHOICE_ICON, checked: automatic, run: () => onChoose(AUTO_APP) },
    SEPARATOR,
    ...apps.map((app) => ({ id: app.id, label: app.name, icon: appIcon(app), checked: !automatic && app.id === choice, run: () => onChoose(app.id) })),
    SEPARATOR,
    ...(offersSystem ? [{ id: SYSTEM_APP, label: SYSTEM_APP_LABEL, icon: AppWindow, checked: choice === SYSTEM_APP, run: () => onChoose(SYSTEM_APP) }] : []),
    ...(onAdd ? [{ id: 'add', label: 'Choose another app…', icon: FolderOpen, run: onAdd }] : []),
  ]);
}
