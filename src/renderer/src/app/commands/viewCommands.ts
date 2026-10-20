import type { ViewDefinition } from '../navigation/viewRegistry';
import { viewCommandId } from '../navigation/views';
import type { Command } from './commandStore';

/** The "Go to" command of each view: what it runs is the window's own (a page window sends it to its workspace window). */
export function viewCommands(views: readonly ViewDefinition[], goTo: (view: ViewDefinition['id']) => void): Command[] {
  return views.map((view) => ({
    id: viewCommandId(view.id),
    group: 'Go to',
    label: view.label,
    icon: view.icon,
    shortcut: view.shortcut,
    run: () => goTo(view.id),
  }));
}
