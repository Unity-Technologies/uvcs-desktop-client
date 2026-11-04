import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { escapeCollapsesDiff, expandDiffOffered, expandDiffWords, leavesExpandedDiff, type NavigationSpot } from '../../components/diffExpansion';
import { collapseDiff, collapseDiffAsAsked, isDiffExpanded, isExpandableDiffInFront, toggleDiffExpanded, useDiffExpanded, useExpandableDiffsChanged } from '../../components/diffExpansionStore';
import { isKeyboardTaken } from '../../lib/mainFocus';
import { windowShortcutMayRun } from '../../lib/modalDialog';
import { formatShortcut, matchesShortcut } from '../../lib/shortcuts';
import { hotkey } from '../../lib/shortcutRegistry';
import { allCommands, useCommands, type Command } from '../commands/commandStore';
import { useNavigation } from '../navigation/navigationStore';

/**
 * Expand Diff in a window showing a place's views and pages, or one page (a page window): its command (⇧⌘E, View ▸
 * Expand Diff, the palette), Esc to leave once nothing else takes it, and the mode ending as the navigation leaves the
 * diff or the window leaves the place (`diffExpansion.ts`).
 */
export function useDiffExpansion(): void {
  const expanded = useDiffExpanded();
  const diffInFront = useDiffInFront();
  const words = expandDiffWords(expanded, formatShortcut(hotkey('collapseDiff')).join(''));
  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'view.expandDiff',
        group: 'App',
        label: words.label,
        icon: expanded ? Minimize2 : Maximize2,
        keywords: ['expand', 'collapse', 'maximize', 'focus', 'zen', 'whole window', 'hide panels'],
        shortcut: hotkey('expandDiff'),
        disabled: !expandDiffOffered(expanded, diffInFront),
        run: () => toggleDiffExpanded('keyboard'),
      },
    ],
    [expanded, diffInFront, words.label],
  );
  useCommands(commands);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const press = {
        isEscape: matchesShortcut(event, hotkey('collapseDiff')),
        defaultPrevented: event.defaultPrevented,
        keyboardTaken: isKeyboardTaken(),
        mayRun: windowShortcutMayRun(event),
        // A command bound to Esc (Files' "Cancel the cut") runs instead, whichever window listener was added first.
        commandClaims: allCommands().some((command) => command.shortcut && !command.disabled && matchesShortcut(event, command.shortcut)),
      };
      if (!escapeCollapsesDiff(isDiffExpanded(), press)) return;
      event.preventDefault();
      collapseDiffAsAsked('keyboard');
    };
    const unsubscribe = useNavigation.subscribe((state, previous) => {
      if (leavesExpandedDiff(spotOf(previous), spotOf(state))) collapseDiff();
    });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsubscribe();
      collapseDiff();
    };
  }, []);
}

/**
 * Whether a diff that can expand is in front, read once the page is drawn: after an Expand button comes or goes, and
 * after a navigation (a view under a page is hidden, not unmounted).
 */
function useDiffInFront(): boolean {
  const registrations = useExpandableDiffsChanged();
  const { view, pages } = useNavigation();
  const [inFront, setInFront] = useState(false);
  useEffect(() => setInFront(isExpandableDiffInFront()), [registrations, view, pages]);
  return inFront;
}

function spotOf({ view, pages }: { view: string; pages: readonly unknown[] }): NavigationSpot {
  return { view, depth: pages.length };
}
