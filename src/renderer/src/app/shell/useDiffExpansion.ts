import { Maximize2, Minimize2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { escapeCollapsesDiff, expandDiffWords, leavesExpandedDiff, type NavigationSpot } from '../../components/diffExpansion';
import { collapseDiff, isDiffExpanded, toggleDiffExpanded, useDiffExpanded } from '../../components/diffExpansionStore';
import { isKeyboardTaken } from '../../lib/mainFocus';
import { windowShortcutMayRun } from '../../lib/modalDialog';
import { formatShortcut, matchesShortcut } from '../../lib/shortcuts';
import { hotkey } from '../../lib/shortcutRegistry';
import { useCommands, type Command } from '../commands/commandStore';
import { useNavigation } from '../navigation/navigationStore';

/**
 * Expand Diff in a window showing a place's views and pages, or one page (a page window): its command (⇧⌘E, View ▸
 * Expand Diff, the palette), Esc to leave once nothing else takes it, and the mode ending as the navigation leaves the
 * diff or the window leaves the place (`diffExpansion.ts`).
 */
export function useDiffExpansion(): void {
  const expanded = useDiffExpanded();
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
        run: toggleDiffExpanded,
      },
    ],
    [expanded, words.label],
  );
  useCommands(commands);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const press = {
        isEscape: matchesShortcut(event, hotkey('collapseDiff')),
        defaultPrevented: event.defaultPrevented,
        keyboardTaken: isKeyboardTaken(),
        mayRun: windowShortcutMayRun(event),
      };
      if (!escapeCollapsesDiff(isDiffExpanded(), press)) return;
      event.preventDefault();
      collapseDiff();
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

function spotOf({ view, pages }: { view: string; pages: readonly unknown[] }): NavigationSpot {
  return { view, depth: pages.length };
}
