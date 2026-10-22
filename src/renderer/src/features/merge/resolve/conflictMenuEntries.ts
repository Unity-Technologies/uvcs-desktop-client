import type { MergeTool } from '@shared/domain/mergeTools';
import { currentExternalApps } from '../../../components/externalApps/externalApps';
import { menuAction, menuSubmenu } from '../../../components/menuWords';
import { withoutAction, type Action, type MenuEntry } from '../../../lib/actions';
import type { ToolForFile } from '../mergeTools/resolveRun';
import { otherTools, toolChoiceEntries } from '../mergeTools/toolChoices';
import type { GroupedEntry } from '../../../lib/menuGroups';
import { oneClickApp, openableVersions, opensAsBinary, type VersionOpeningContext } from './conflictVersionOpening';
import type { FileConflictDecision } from './fileConflictDecision';
import { offersKeepBase } from './conflictPanelView';
import { keepVersionEntries } from './keepVersionEntries';
import type { FileConflictState } from './useFileConflicts';

/** What the menu of conflicting files needs, wherever they are resolved: the merge page and Incoming. */
export interface ConflictMenuContext extends VersionOpeningContext {
  /** The tool each file opens in (`useMergeToolFor`); none when no merge tool was found. */
  toolFor: ToolForFile;
  /** Every merge tool found, for "Resolve with ▸". */
  tools: MergeTool[];
  /** Files resolve one by one in a tool: no other opens meanwhile. */
  running: boolean;
  decide: (key: string, decision: FileConflictDecision) => void;
  reset: (key: string) => void;
  resolveIn: (key: string, tool: MergeTool) => void;
}

/**
 * What the conflicting files selected add to the menu of a list of changed files, the same on the merge page and in
 * Incoming: one of them, "Resolve in <its tool>", "Resolve with ▸" any other this once, and "Open version ▸" with each side's version and the base; any, Keep
 * yours, incoming or base (`keepVersionEntries`); one the user decided, Start over. A file a tool (or Smart Merge) has
 * open is settled by its outcome, as its toolbar says: nothing here decides it meanwhile. Nothing is read to build it.
 */
export function conflictMenuEntries(selected: FileConflictState[], context: ConflictMenuContext): GroupedEntry[] {
  const single = selected.length === 1 ? selected[0]! : null;
  const settleable = selected.filter((state) => !state.openTool);
  return [
    ...(single ? singleConflictEntries(single, context) : []),
    ...keepVersionEntries(
      settleable.map((state) => ({ key: state.file.key, offersBase: offersKeepBase(state) })),
      context.labels,
      context.decide,
    ),
    ...(single?.decidedByUser && !single.openTool ? [menuAction('startOver', () => context.reset(single.file.key))] : []),
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

/**
 * "Resolve in <its tool>" and "Resolve with ▸" the other tools (a text file, a tool found, none resolving one by one),
 * and "Open version ▸" with each side's version and the base.
 */
function singleConflictEntries(state: FileConflictState, context: ConflictMenuContext): GroupedEntry[] {
  const tool = context.toolFor(state);
  const opens = tool && !state.isBinary && !state.openTool;
  const resolveIn = opens
    ? [
        menuAction('resolveIn', () => context.resolveIn(state.file.key, tool), {
          label: `Resolve in ${tool.name}`,
          disabled: context.running,
          disabledReason: context.running ? 'Files are resolving one by one' : undefined,
        }),
      ]
    : [];
  const others = otherTools(context.tools, tool);
  const resolveWith =
    opens && !context.running && others.length > 0
      ? [menuSubmenu('resolveWith', toolChoiceEntries(others.map((other) => ({ tool: other, label: other.name })), (other) => context.resolveIn(state.file.key, other)))]
      : [];
  return [...resolveIn, ...resolveWith, menuSubmenu('openVersion', versionEntries(state, context))];
}

/**
 * Yours (the workspace file, or the destination's version merging into a server branch), Incoming, and Base, each
 * opening with one click (`oneClickApp`: a text in the user's editor, a binary with its default app).
 */
function versionEntries(state: FileConflictState, context: ConflictMenuContext): Action[] {
  const editorId = oneClickApp(state, currentExternalApps());
  return openableVersions(state, context).map(({ version, label, open }) => ({ id: `openVersion.${version}`, label, run: () => void open(editorId) }));
}
