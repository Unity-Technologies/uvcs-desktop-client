import { AppWindow, FolderOpen } from 'lucide-react';
import { AUTO_APP, SYSTEM_APP } from '@shared/domain/externalApps';
import { appIcon } from '../../components/externalApps/appIcon';
import { SEPARATOR, tidyMenu, type Icon, type MenuEntry } from '../../lib/actions';
import { AUTOMATIC_CHOICE_ICON, automaticAppDescription } from './automaticApp';

/** An app a setting can pick: an editor, a terminal, a merge tool. */
export interface PickableApp {
  id: string;
  name: string;
  /** Where it is, under its name. */
  location: string;
  icon?: string;
}

/**
 * The choice that leaves picking the app to the app ("Automatic", or "Same as others" for a merge tool): it uses
 * the app `usedId` names, and says what it would pick (`rule`) while it picks none.
 */
export interface AutomaticChoice {
  id: string;
  label: string;
  rule: string;
  /** An app picked that isn't found here shows as this choice (Automatic); otherwise as itself, "Not found". */
  coversMissing: boolean;
}

/** "Automatic", by its rule: an app picked that's gone shows as it, as the app falls back to it. */
export function automaticChoice(rule: string): AutomaticChoice {
  return { id: AUTO_APP, label: 'Automatic', rule, coversMissing: true };
}

/** One setting's apps, as a drop-down: "Automatic", every app found, and for the editor each file's default app. */
export interface AppPickerChoices {
  apps: PickableApp[];
  /** The setting: `auto`, `system` or an app id. */
  choice: string;
  /** The app the setting resolves to now (what "Automatic" uses), if any. */
  usedId: string | null;
  /** The choice that picks for the user, first; none where an app must be picked (a merge tool rule). */
  automatic: AutomaticChoice | null;
  /** Offers opening each file with its default app (the editor). */
  offersSystem?: boolean;
  /** What to call an app picked that isn't found here (a merge tool known by name). */
  missingName?: string;
  onChoose: (choice: string) => void;
  /** Offers adding another app (the editor, a merge tool). */
  onAdd?: () => void;
  /** Entries after the apps, about the app picked ("How Meld opens…"). */
  more?: MenuEntry[];
}

/** What the drop-down's button shows: the choice, a line about it, and its icon. */
export interface PickedApp {
  label: string;
  description: string;
  icon: Icon | undefined;
}

export const SYSTEM_APP_LABEL = "Each file's default app";

/** The choice made, as the button shows it: an app with where it is, or "Automatic" with the app it uses. */
export function pickedApp(choices: AppPickerChoices): PickedApp {
  const { apps, choice, usedId, automatic, offersSystem, missingName } = choices;
  if (offersSystem && choice === SYSTEM_APP) return { label: SYSTEM_APP_LABEL, description: 'As the OS opens it', icon: AppWindow };
  const used = apps.find((app) => app.id === usedId);
  if (automatic && isAutomatic(choices)) {
    return { label: automatic.label, description: automaticAppDescription(used?.name, automatic.rule), icon: (used && appIcon(used)) ?? AUTOMATIC_CHOICE_ICON };
  }
  const picked = apps.find((app) => app.id === choice);
  if (!picked) return { label: missingName ?? choice, description: 'Not found on this computer', icon: AppWindow };
  return { label: picked.name, description: picked.location, icon: appIcon(picked) ?? AppWindow };
}

/** The drop-down's entries, the choice made checked. */
export function appPickerEntries(choices: AppPickerChoices): MenuEntry[] {
  const { apps, choice, usedId, automatic, offersSystem, onChoose, onAdd, more = [] } = choices;
  const isAuto = isAutomatic(choices) && !(offersSystem && choice === SYSTEM_APP);
  const used = apps.find((app) => app.id === usedId);
  return tidyMenu([
    automatic && {
      id: automatic.id,
      label: used ? `${automatic.label} (${used.name})` : automatic.label,
      icon: AUTOMATIC_CHOICE_ICON,
      checked: isAuto,
      run: () => onChoose(automatic.id),
    },
    SEPARATOR,
    ...apps.map((app) => ({ id: app.id, label: app.name, icon: appIcon(app), checked: !isAuto && app.id === choice, run: () => onChoose(app.id) })),
    SEPARATOR,
    ...(offersSystem ? [{ id: SYSTEM_APP, label: SYSTEM_APP_LABEL, icon: AppWindow, checked: choice === SYSTEM_APP, run: () => onChoose(SYSTEM_APP) }] : []),
    ...(onAdd ? [{ id: 'add', label: 'Choose another app…', icon: FolderOpen, run: onAdd }] : []),
    ...(more.length > 0 ? [SEPARATOR, ...more] : []),
  ]);
}

/** The automatic choice is made, or the app chosen isn't on offer anymore and shows as it. */
function isAutomatic({ automatic, choice, apps }: AppPickerChoices): boolean {
  if (!automatic) return false;
  return choice === automatic.id || (automatic.coversMissing && !apps.some((app) => app.id === choice));
}
