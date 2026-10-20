import type { MergeTool } from '@shared/domain/mergeTools';
import { currentExternalApps } from '../../../components/externalApps/externalApps';
import { menuAction, menuSubmenu } from '../../../components/menuWords';
import { withoutAction, type Action, type MenuEntry } from '../../../lib/actions';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { oneClickApp, openableVersions, opensAsBinary, type VersionOpeningContext } from './conflictVersionOpening';
import type { FileConflictDecision } from './fileConflictDecision';
import { offersKeepBase } from './conflictPanelView';
import { keepVersionEntries } from './keepVersionEntries';
import type { FileConflictState } from './useFileConflicts';

/** What the menu of conflicting files needs, wherever they are resolved: the merge page and Incoming. */
export interface ConflictMenuContext extends VersionOpeningContext {
  /** The tool "Resolve in…" opens; none when no merge tool was found. */
  preferredTool: MergeTool | undefined;
  /** Files resolve one by one in a tool: no other opens meanwhile. */
  running: boolean;
  decide: (key: string, decision: FileConflictDecision) => void;
  reset: (key: string) => void;
  resolveIn: (key: string, tool: MergeTool) => void;
}

/**
 * What the conflicting files selected add to the menu of a list of changed files, the same on the merge page and in
 * Incoming: one of them, "Resolve in <tool>" and "Open version ▸" with each side's version and the base; any, Keep
 * yours, incoming or base (`keepVersionEntries`); one the user decided, Start over. Nothing is read to build it.
 */
export function conflictMenuEntries(selected: FileConflictState[], context: ConflictMenuContext): GroupedEntry[] {
  const single = selected.length === 1 ? selected[0]! : null;
  return [
    ...(single ? singleConflictEntries(single, context) : []),
    ...keepVersionEntries(
      selected.map((state) => ({ key: state.file.key, offersBase: offersKeepBase(state) })),
      context.labels,
      context.decide,
    ),
    ...(single?.decidedByUser ? [menuAction('startOver', () => context.reset(single.file.key))] : []),
  ];
}

/**
 * A list's menu once the conflicts selected are in it: one binary conflict opens its versions only from "Open version
 * ▸", with their default app; the list's own "Open this revision in <editor>" would open the incoming one a second
 * way, in an editor. Saving it stays.
 */
export function withConflictOpening(menu: MenuEntry[], selected: FileConflictState[]): MenuEntry[] {
  const single = selected.length === 1 ? selected[0]! : null;
  if (!single || !opensAsBinary(single)) return menu;
  return withoutAction(withoutAction(menu, 'openRevision'), 'openRevisionWith');
}

/** "Resolve in <tool>" (a text file, a tool found) and "Open version ▸" with each side's version and the base. */
function singleConflictEntries(state: FileConflictState, context: ConflictMenuContext): GroupedEntry[] {
  const { preferredTool: tool } = context;
  const resolveIn =
    tool && !state.isBinary && !state.openTool
      ? [
          menuAction('resolveIn', () => context.resolveIn(state.file.key, tool), {
            label: `Resolve in ${tool.name}`,
            disabled: context.running,
            disabledReason: context.running ? 'Files are resolving one by one' : undefined,
          }),
        ]
      : [];
  return [...resolveIn, menuSubmenu('openVersion', versionEntries(state, context))];
}

/**
 * Yours (the workspace file, or the destination's version merging into a server branch), Incoming, and Base, each
 * opening with one click (`oneClickApp`: a text in the user's editor, a binary with its default app).
 */
function versionEntries(state: FileConflictState, context: ConflictMenuContext): Action[] {
  const editorId = oneClickApp(state, currentExternalApps());
  return openableVersions(state, context).map(({ version, label, open }) => ({ id: `openVersion.${version}`, label, run: () => void open(editorId) }));
}
