import { Command as Cmdk } from 'cmdk';
import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createFuzzyIndex, fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import { useShortcut } from '../../lib/useShortcut';
import { HighlightQuery } from '../../ui/Highlight';
import { Spinner } from '../../ui/Spinner';
import { useSession } from '../workspace/sessionStore';
import { useCommandPalette } from './commandPaletteStore';
import { useCommandStore, type Command } from './commandStore';
import { PaletteFooter } from './PaletteFooter';
import { PaletteRow } from './PaletteRow';
import { isInScope, LIST_ORDER, parseScope, type SectionId } from './paletteScope';
import { collapseGroups, COLLAPSED_ROWS, rankGroups, type SearchGroup, type SearchResult } from './searchResults';
import { usePaletteSearch } from './usePaletteSearch';
import { useWorkspaceResults } from './useWorkspaceResults';
import styles from './CommandPalette.module.css';
import { hotkeys } from '../../lib/shortcutRegistry';

const MAX_COMMANDS = 50;

export function CommandPalette() {
  const { isOpen: open, setOpen, toggle } = useCommandPalette();

  const [toggleKey, openKey] = hotkeys('commandPalette');
  useShortcut(toggleKey, toggle);
  useShortcut(openKey, () => setOpen(true));

  return open ? <OpenPalette close={() => setOpen(false)} /> : null;
}

/**
 * One box for everything: commands, files, branches, labels, workspaces, changesets, shelves and code reviews, each kind in its
 * own section capped at a few rows ("N more" expands it). Empty, it lists what is at hand; typed, the sections with
 * the best matches come first. `>`, `@`, `/` and `#` narrow the search. Enter opens a result, Tab its actions.
 * Ranks everything itself (cmdk only renders and moves the selection).
 */
function OpenPalette({ close }: { close: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<SectionId>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ranking hundreds of thousands of paths takes a few frames; typing stays responsive meanwhile.
  const deferredQuery = useDeferredValue(query);
  const { scope, text } = parseScope(deferredQuery);
  const commandsByOwner = useCommandStore((state) => state.commandsByOwner);
  const workspacePath = useSession((state) => state.workspacePath);
  useFocusBackOnClose();

  const commands = useMemo(
    // Opening the palette from inside it would do nothing.
    () => [...commandsByOwner.values()].flat().filter((command) => !command.disabled && command.id !== 'app.commandPalette'),
    [commandsByOwner],
  );
  const commandIndex = useMemo(() => createFuzzyIndex(commands.map(commandSearchText)), [commands]);
  const { groups: objectGroups, isLoading } = usePaletteSearch(workspacePath, text, scope);
  const workspaceGroup = useWorkspaceResults(workspacePath, text);

  const groups = useMemo<SearchGroup[]>(() => {
    const commandResults = text
      ? commandIndex.rank(text, MAX_COMMANDS).map((index) => commandResult(commands[index]!, text))
      : commands.map((command) => commandResult(command));
    const commandGroup: SearchGroup = { section: 'commands', heading: 'Commands', results: commandResults };
    const all = [commandGroup, ...objectGroups, workspaceGroup].filter((group) => group.results.length > 0 && isInScope(group.section, scope));
    return text ? rankGroups(all) : all.sort((a, b) => LIST_ORDER.indexOf(a.section) - LIST_ORDER.indexOf(b.section));
  }, [commands, commandIndex, text, scope, objectGroups, workspaceGroup]);

  // A prefix asks for one kind of thing, so its sections show in full.
  const shown = collapseGroups(groups, scope === 'all' ? expanded : 'all');
  const values = shown.flatMap((group) => [...group.results.map((result) => result.id), ...(group.more > 0 ? [moreValue(group.section)] : [])]);
  // Keeps the user's pick while results stream in; falls back to the first result when it disappears.
  const selectedValue = values.includes(selected) ? selected : (values[0] ?? '');
  const selectedResult = shown.flatMap((group) => group.results).find((result) => result.id === selectedValue);

  const run = (result: SearchResult): void => {
    if (!result.keepOpen) close();
    result.run();
  };

  const expand = (section: SectionId): void => {
    setExpanded((sections) => new Set(sections).add(section));
    // The first row that was held back takes the place of "N more".
    setSelected(groups.find((group) => group.section === section)?.results[COLLAPSED_ROWS]?.id ?? '');
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    // Keys pressed in a row's actions menu bubble up here through its portal; they are the menu's, not cmdk's.
    if (event.target !== inputRef.current) return event.preventDefault();
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      event.preventDefault();
      if (selectedResult?.menu) setMenuFor(selectedResult.id);
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={close}>
      <Cmdk
        className={styles.palette}
        label="Command palette"
        loop
        shouldFilter={false}
        value={selectedValue}
        onValueChange={setSelected}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.search}>
          <Cmdk.Input
            ref={inputRef}
            className={styles.input}
            placeholder="Search files, branches, labels, changesets, commands…"
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              setSelected('');
              setExpanded(new Set());
            }}
            spellCheck={false}
            autoFocus
          />
          {isLoading && text && <Spinner size={14} />}
        </div>
        <HighlightQuery query={text}>
          <Cmdk.List className={styles.list}>
            <Cmdk.Empty className={styles.empty}>{isLoading ? 'Searching…' : 'Nothing matches.'}</Cmdk.Empty>
            {shown.map((group) => (
              <Cmdk.Group key={group.section} heading={group.heading} className={styles.group}>
                {group.results.map((result) => (
                  <PaletteRow
                    key={result.id}
                    result={result}
                    selected={result.id === selectedValue}
                    menuOpen={menuFor === result.id}
                    onMenuOpenChange={(open) => setMenuFor(open ? result.id : null)}
                    onMenuClosed={() => inputRef.current?.focus()}
                    onRun={() => run(result)}
                  />
                ))}
                {group.more > 0 && (
                  <Cmdk.Item value={moreValue(group.section)} className={styles.more} onSelect={() => expand(group.section)}>
                    {group.more} more {group.heading.toLowerCase()}
                  </Cmdk.Item>
                )}
              </Cmdk.Group>
            ))}
          </Cmdk.List>
        </HighlightQuery>
        <PaletteFooter inWorkspace={workspacePath !== null} />
      </Cmdk>
    </div>
  );
}

/** Closing gives focus back to where it was (the list the palette was opened over), unless it went away meanwhile. */
function useFocusBackOnClose(): void {
  // Read while rendering, before the palette's field takes focus.
  const [previous] = useState(() => document.activeElement);
  useEffect(() => {
    return () => {
      if (previous instanceof HTMLElement && previous !== document.body && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [previous]);
}

function moreValue(section: SectionId): string {
  return `more:${section}`;
}

/** The command's group reads after it ("Changes · Go to"), so commands with the same name in different groups can be told apart. */
function commandResult(command: Command, query?: string): SearchResult {
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

function commandSearchText(command: Command): string {
  return [command.label, ...(command.keywords ?? [])].join(' ');
}
