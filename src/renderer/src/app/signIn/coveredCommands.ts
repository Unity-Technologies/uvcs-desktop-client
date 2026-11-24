import { create } from 'zustand';
import type { Command } from '../commands/commandStore';

/**
 * Whether the sign-in screen covers this window's place (`SignInCover`): then the place's commands are off, from their
 * shortcuts, the palette and the app menu alike (`commandsWhileCovered`), so nothing works on the place unseen.
 */
export const useSignInCover = create<{ covered: boolean }>(() => ({ covered: false }));

/**
 * The commands that run while the sign-in screen covers the place (`covered`): only the app's own (`app.…`: Home,
 * Settings, a new window, the palette, About), never one of the place's (going to a view, an operation, Refresh). The
 * screen's own buttons (Check again) are no commands and always work.
 */
export function commandsWhileCovered<T extends Pick<Command, 'id'>>(commands: readonly T[], covered: boolean): T[] {
  return covered ? commands.filter((command) => command.id.startsWith('app.')) : [...commands];
}
