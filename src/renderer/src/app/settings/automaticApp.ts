import { AUTO_APP, type ExternalApp } from '@shared/domain/externalApps';

/** What "Automatic" picks, in its tooltip: the rule, which the line under it shouldn't repeat. */
export const AUTOMATIC_EDITOR_RULE = 'The first editor found';
export const AUTOMATIC_TERMINAL_RULE = "Your system's usual terminal";

/** The line under "Automatic": the app it picks now ("Uses Visual Studio Code"), or the rule while none is found. */
export function automaticAppDescription(pickedName: string | undefined, rule: string): string {
  return pickedName ? `Uses ${pickedName}` : rule;
}

/** "Automatic" is chosen, or the app chosen isn't on offer anymore, so the automatic one is used. */
export function isAutomatic(choice: string, apps: ExternalApp[]): boolean {
  return choice === AUTO_APP || !apps.some((app) => app.id === choice);
}
