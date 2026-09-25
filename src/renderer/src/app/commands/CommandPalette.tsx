import { Command as Cmdk } from 'cmdk';
import { useDeferredValue, useMemo, useState } from 'react';
import { createFuzzyIndex, fuzzyMatchPositions, fuzzyMatchQuality } from '../../lib/fuzzyIndex';
import { useShortcut } from '../../lib/useShortcut';
import { Highlight, HighlightQuery } from '../../ui/Highlight';
import { Kbd } from '../../ui/Kbd';
import { useSession } from '../workspace/sessionStore';
import { useCommandPalette } from './commandPaletteStore';
import { useCommandStore, type Command } from './commandStore';
import { rankGroups, type SearchGroup, type SearchResult } from './searchResults';
import { usePaletteSearch } from './usePaletteSearch';
import styles from './CommandPalette.module.css';

const MAX_COMMANDS = 6;

export function CommandPalette() {
  const { isOpen: open, setOpen, toggle } = useCommandPalette();

  useShortcut('mod+k', toggle);
  useShortcut('mod+shift+p', () => setOpen(true));

  return open ? <OpenPalette close={() => setOpen(false)} /> : null;
}

/**
 * Every command while the query is empty; then the best commands, workspace files and repository objects,
 * with the most relevant groups first. Ranks everything itself (cmdk only renders).
 */
function OpenPalette({ close }: { close: () => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  // Ranking hundreds of thousands of paths takes a few frames; typing stays responsive meanwhile.
  const deferredQuery = useDeferredValue(query);
  const commandsByOwner = useCommandStore((state) => state.commandsByOwner);
  const workspacePath = useSession((state) => state.workspacePath);

  const commands = useMemo(() => [...commandsByOwner.values()].flat().filter((command) => !command.disabled), [commandsByOwner]);
  const commandIndex = useMemo(() => createFuzzyIndex(commands.map(commandSearchText)), [commands]);
  const { groups: objectGroups, isLoading } = usePaletteSearch(workspacePath, deferredQuery);

  const groups = useMemo<SearchGroup[]>(() => {
    if (!deferredQuery.trim()) {
      return [...groupCommands(commands)].map(([heading, groupCommands]) => ({ heading, results: groupCommands.map((command) => commandResult(command)) }));
    }
    const ranked = commandIndex.rank(deferredQuery, MAX_COMMANDS).map((index) => commandResult(commands[index]!, deferredQuery));
    return rankGroups([{ heading: 'Commands', results: ranked }, ...objectGroups]);
  }, [commands, commandIndex, deferredQuery, objectGroups]);

  const values = groups.flatMap((group) => group.results.map((result) => result.id));
  // Keeps the user's pick while results stream in; falls back to the first result when it disappears.
  const selectedValue = values.includes(selected) ? selected : (values[0] ?? '');

  const run = (result: SearchResult): void => {
    if (!result.keepOpen) close();
    result.run();
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
        onKeyDown={(event) => event.key === 'Escape' && close()}
      >
        <Cmdk.Input
          className={styles.input}
          placeholder="Fuzzy search everything: files, branches, labels, changesets, commands…"
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setSelected('');
          }}
          autoFocus
        />
        <HighlightQuery query={deferredQuery}>
          <Cmdk.List className={styles.list}>
            <Cmdk.Empty className={styles.empty}>{isLoading ? 'Searching…' : 'Nothing matches.'}</Cmdk.Empty>
            {groups.map((group) => (
              <Cmdk.Group key={group.heading} heading={group.heading} className={styles.group}>
                {group.results.map((result) => {
                  const Icon = result.icon;
                  return (
                    <Cmdk.Item key={result.id} value={result.id} className={styles.item} disabled={result.disabled} onSelect={() => run(result)}>
                      <span className={styles.icon}>
                        <Icon size={15} className={result.busy ? 'spinning' : undefined} />
                      </span>
                      <span className={styles.label}>
                        <Highlight text={result.label} positions={result.labelMatches} />
                      </span>
                      {result.detail && (
                        <span className={styles.detail}>
                          <Highlight text={result.detail} positions={result.detailMatches} />
                        </span>
                      )}
                      {result.shortcut && <Kbd keys={result.shortcut} />}
                    </Cmdk.Item>
                  );
                })}
              </Cmdk.Group>
            ))}
          </Cmdk.List>
        </HighlightQuery>
      </Cmdk>
    </div>
  );
}

/** Without a query, a command is listed under its own group, so it needs no detail and highlights nothing. */
function commandResult(command: Command, query?: string): SearchResult {
  const searchText = commandSearchText(command);
  return {
    id: `command:${command.id}`,
    icon: command.icon ?? (() => null),
    label: command.label,
    detail: query ? command.group : undefined,
    shortcut: command.shortcut,
    // Commands match on their label and keywords; only the label is shown.
    labelMatches: query ? fuzzyMatchPositions(searchText, query).filter((position) => position < command.label.length) : [],
    quality: query ? fuzzyMatchQuality(searchText, query) : undefined,
    run: command.run,
  };
}

function commandSearchText(command: Command): string {
  return [command.label, ...(command.keywords ?? [])].join(' ');
}

function groupCommands(commands: Command[]): Map<string, Command[]> {
  const groups = new Map<string, Command[]>();
  for (const command of commands) groups.set(command.group, [...(groups.get(command.group) ?? []), command]);
  return groups;
}
