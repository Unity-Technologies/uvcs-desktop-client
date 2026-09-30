import { fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import type { Command } from './commandStore';
import type { SearchResult } from './searchResults';

/** The commands the palette offers: every one registered and enabled, but the one opening the palette, which would do nothing there. */
export function paletteCommands(commandsByOwner: ReadonlyMap<string, readonly Command[]>): Command[] {
  return [...commandsByOwner.values()].flat().filter((command) => !command.disabled && command.id !== 'app.commandPalette');
}

/** The command's group reads after it ("Changes · Go to"), so commands with the same name in different groups can be told apart. */
export function commandResult(command: Command, query?: string): SearchResult {
  const searchText = commandSearchText(command);
  return {
    id: `command:${command.id}`,
    icon: command.icon ?? (() => null),
    label: command.label,
    detail: command.group,
    shortcut: command.shortcut,
    // Commands match on their label and keywords; only the label is shown.
    labelMatches: query ? fuzzyMatchPositions(searchText, query).filter((position) => position < command.label.length) : [],
    detailMatches: [],
    quality: query ? fuzzyMatchQuality(searchText, query) : undefined,
    run: command.run,
  };
}

/** What a command is found by: its label, then its keywords. */
export function commandSearchText(command: Command): string {
  return [command.label, ...(command.keywords ?? [])].join(' ');
}
