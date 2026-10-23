import type { XlinkTarget } from '@shared/domain/explorer';
import { fullBranchName, type NewXlink, type XlinkEdit, type XlinkExpansionRule, type XlinkPoint, type XlinkRule } from '@shared/domain/xlinks';
import { xlinkKind, xlinkRepository } from '../../components/xlinkWords';
import { itemNameProblem } from '../files/itemName';

/** What the xlink dialog creates or edits. */
export type XlinkDialogTarget =
  /** A new xlink in `directory` (`''` is the root), whose names it must not take. */
  | { kind: 'create'; directory: string; siblings: readonly string[] }
  /**
   * The xlink at `path`, with the rules it has (`XlinksApi.rules`). `added` while it isn't checked in yet: saving
   * changes the new xlink rather than checking it out.
   */
  | { kind: 'edit'; path: string; name: string; xlink: XlinkTarget; rules: readonly XlinkExpansionRule[]; added: boolean };

export type XlinkPointKind = XlinkPoint['kind'];

/** A row of the rules list, as typed. */
export interface RuleRow {
  /** Keeps the row's fields as the rows above it come and go. */
  key: number;
  from: string;
  to: string;
  /** Added by `cm` as a change created the xlinked repository's branch, until it is edited. */
  automatic: boolean;
}

/** The dialog's fields, as typed. */
export interface XlinkDraft {
  name: string;
  /** `name@server`; null until one is picked. */
  repository: string | null;
  pointKind: XlinkPointKind;
  /** The branch, changeset number or label `pointKind` names. */
  point: string;
  writable: boolean;
  relativeServer: boolean;
  folder: string;
  rules: RuleRow[];
}

export function draftOf(target: XlinkDialogTarget): XlinkDraft {
  if (target.kind === 'create') {
    // An xlink most often follows the other repository's main line: its latest changeset.
    return { name: '', repository: null, pointKind: 'branch', point: '/main', writable: false, relativeServer: false, folder: '/', rules: [] };
  }
  const { xlink, rules } = target;
  return {
    name: target.name,
    repository: xlink.server ? `${xlink.repository}@${xlink.server}` : xlink.repository,
    pointKind: 'changeset',
    point: String(xlink.changeset),
    writable: xlink.writable,
    relativeServer: false,
    folder: xlink.path,
    rules: rules.map((rule, index) => ({ key: index, from: rule.from, to: rule.to, automatic: !rule.userDefined })),
  };
}

/**
 * The draft pointing at another kind of point: a branch starts on the main one, and an edited xlink's changeset on
 * the one it points to; a label starts empty.
 */
export function withPointKind(target: XlinkDialogTarget, draft: XlinkDraft, pointKind: XlinkPointKind): XlinkDraft {
  const point = pointKind === 'branch' ? '/main' : pointKind === 'changeset' && target.kind === 'edit' ? String(target.xlink.changeset) : '';
  return { ...draft, pointKind, point };
}

/** The draft with an empty rule row at the end, to type into. */
export function withNewRule(draft: XlinkDraft): XlinkDraft {
  const key = Math.max(-1, ...draft.rules.map((rule) => rule.key)) + 1;
  return { ...draft, rules: [...draft.rules, { key, from: '', to: '', automatic: false }] };
}

/** The draft with the rule row `key` typed into: an edited rule is the user's own. */
export function withRuleChange(draft: XlinkDraft, key: number, change: Partial<Pick<RuleRow, 'from' | 'to'>>): XlinkDraft {
  return { ...draft, rules: draft.rules.map((rule) => (rule.key === key ? { ...rule, ...change, automatic: false } : rule)) };
}

export function withoutRule(draft: XlinkDraft, key: number): XlinkDraft {
  return { ...draft, rules: draft.rules.filter((rule) => rule.key !== key) };
}

/**
 * Where a branch field's picker reads branches: a rule's `from` side the workspace's repository, its `to` side and
 * the branch the xlink points to the xlinked one, which a new xlink has only once picked.
 */
export interface BranchSource {
  title: string;
  /** Another repository's than the workspace's (`name@server`); undefined for the workspace's own. */
  repository: string | undefined;
  /** Why it can't be picked from yet. */
  unavailable: string | undefined;
}

/** What the dialog shows and lets the user change, from what is typed. */
export interface XlinkDialogFields {
  title: string;
  description: string;
  saveLabel: string;
  /** Only a new xlink is named, given its repository and made writable or not: `cm` changes only where one points. */
  isNew: boolean;
  /** Only a read-only xlink shows a folder of its repository (`cm`: "Only xlinks to root (/) are currently supported for writable Xlinks"). */
  showsFolder: boolean;
  /** Only a writable xlink takes changes, so only it has branches to expand to. */
  showsRules: boolean;
  /** The rules' column headings, over the rows once there is one. */
  showsRuleHeadings: boolean;
  pointLabel: string;
  pointPlaceholder: string;
  pointHint: string | undefined;
  nameError: string | undefined;
  pointError: string | undefined;
  /** The branches a rule's `from` side picks from: the workspace's. */
  workspaceBranches: BranchSource;
  /** The branches a rule's `to` side and the branch it points to pick from: the xlinked repository's. */
  xlinkedBranches: BranchSource;
  /** What shows under a rule row, by its key: its problem, or that `cm` added it. */
  ruleNotes: ReadonlyMap<number, RuleNote>;
  /** Why it can't be saved yet; null once it can. */
  problem: string | null;
}

export interface RuleNote {
  text: string;
  isError: boolean;
}

const AUTOMATIC_RULE_NOTE = 'Added when a change made in the xlink created its branch';

const POINT_WORDS: Record<XlinkPointKind, { label: string; placeholder: string; hint?: string }> = {
  branch: { label: 'Branch', placeholder: '/main', hint: 'Its latest changeset. The xlink stays there until it’s edited again.' },
  changeset: { label: 'Changeset', placeholder: '17' },
  label: { label: 'Label', placeholder: 'v1.2' },
};

export function xlinkDialogFields(target: XlinkDialogTarget, draft: XlinkDraft): XlinkDialogFields {
  const isNew = target.kind === 'create';
  const nameError = isNew && draft.name.trim() !== '' ? itemNameProblem(draft.name, target.siblings, { allowFolders: false }) : undefined;
  const pointError = pointProblem(draft);
  const ruleErrors = draft.writable ? ruleProblems(draft.rules) : new Map<number, string>();
  const words = POINT_WORDS[draft.pointKind];
  const unchanged = target.kind === 'edit' && xlinkEditOf(target, draft) === null;
  const problem =
    (isNew && draft.name.trim() === '' && 'Name its folder') ||
    nameError ||
    (draft.repository === null && 'Choose its repository') ||
    pointError ||
    ruleErrors.values().next().value ||
    (unchanged && 'Nothing changed') ||
    null;

  return {
    title: isNew ? 'New xlink' : `Edit xlink ${target.name}`,
    description: isNew ? descriptionOfNew(target.directory) : descriptionOfEdited(target),
    saveLabel: isNew ? 'Create xlink' : 'Save',
    isNew,
    showsFolder: isNew && !draft.writable,
    showsRules: draft.writable,
    showsRuleHeadings: draft.writable && draft.rules.length > 0,
    pointLabel: words.label,
    pointPlaceholder: words.placeholder,
    pointHint: words.hint,
    nameError,
    pointError: draft.point.trim() === '' ? undefined : pointError,
    workspaceBranches: { title: 'Branch of this workspace', repository: undefined, unavailable: undefined },
    xlinkedBranches: draft.repository
      ? { title: `Branch of ${draft.repository}`, repository: draft.repository, unavailable: undefined }
      : { title: 'Branch of its repository', repository: undefined, unavailable: 'Choose its repository first' },
    ruleNotes: ruleNotesOf(draft.rules, ruleErrors),
    problem,
  };
}

function ruleNotesOf(rows: readonly RuleRow[], errors: ReadonlyMap<number, string>): Map<number, RuleNote> {
  return new Map(
    rows.flatMap((row): [number, RuleNote][] => {
      const error = errors.get(row.key);
      if (error) return [[row.key, { text: error, isError: true }]];
      return row.automatic ? [[row.key, { text: AUTOMATIC_RULE_NOTE, isError: false }]] : [];
    }),
  );
}

function descriptionOfEdited({ xlink, added }: Extract<XlinkDialogTarget, { kind: 'edit' }>): string {
  const what = `${xlinkKind(xlink)} to ${xlinkRepository(xlink)}.`;
  return added ? `${what} Not checked in yet.` : `${what} Saving checks it out: check it in to share it.`;
}

function descriptionOfNew(directory: string): string {
  return `A folder in /${directory} showing another repository. Its files come once it’s checked in and the workspace updated.`;
}

/** Where the draft points, once it names a point. */
export function pointOf({ pointKind, point }: Pick<XlinkDraft, 'pointKind' | 'point'>): XlinkPoint | undefined {
  const typed = point.trim();
  if (typed === '' || typed.includes('@')) return undefined;
  switch (pointKind) {
    case 'changeset':
      return /^\d+$/.test(typed) ? { kind: 'changeset', changeset: Number(typed) } : undefined;
    case 'branch':
      return { kind: 'branch', branch: fullBranchName(typed) };
    case 'label':
      return { kind: 'label', label: typed };
  }
}

function pointProblem(draft: XlinkDraft): string | undefined {
  if (pointOf(draft)) return undefined;
  if (draft.point.trim() === '') return `Name its ${POINT_WORDS[draft.pointKind].label.toLowerCase()}`;
  if (draft.point.includes('@')) return 'Only the name: the repository is chosen above';
  return 'A changeset number, like 17';
}

/** The rules typed: rows left empty don't count. */
function typedRules(rows: readonly RuleRow[]): (RuleRow & XlinkRule)[] {
  return rows
    .filter((row) => row.from.trim() !== '' || row.to.trim() !== '')
    .map((row) => ({ ...row, from: fullBranchName(row.from), to: fullBranchName(row.to) }));
}

/** Each row's problem: a branch missing, or a second rule for the same branch, which `cm` refuses. */
function ruleProblems(rows: readonly RuleRow[]): Map<number, string> {
  const problems = new Map<number, string>();
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.from.trim() === '' && row.to.trim() === '') continue;
    if (row.from.trim() === '' || row.to.trim() === '') problems.set(row.key, 'Name both branches');
    else if (row.from.includes('@') || row.to.includes('@')) problems.set(row.key, 'Only the branch names');
    else if (seen.has(fullBranchName(row.from))) problems.set(row.key, `${fullBranchName(row.from)} has a rule already`);
    seen.add(fullBranchName(row.from));
  }
  return problems;
}

/** The xlink to create in `directory`; call once `xlinkDialogFields` finds no problem. */
export function newXlinkOf(directory: string, draft: XlinkDraft): NewXlink {
  const name = draft.name.trim();
  return {
    path: directory ? `${directory}/${name}` : name,
    repository: draft.repository!,
    point: pointOf(draft)!,
    writable: draft.writable,
    relativeServer: draft.relativeServer,
    folder: draft.writable ? '/' : draft.folder,
    rules: draft.writable ? typedRules(draft.rules).map(({ from, to }) => ({ from, to })) : [],
  };
}

/** What the draft changes in the xlink it edits; null when nothing. */
export function xlinkEditOf(target: Extract<XlinkDialogTarget, { kind: 'edit' }>, draft: XlinkDraft): XlinkEdit | null {
  const point = pointOf(draft);
  const pointChanged = point !== undefined && !(point.kind === 'changeset' && point.changeset === target.xlink.changeset);
  const { removed, added } = draft.writable ? rulesChange(target.rules, typedRules(draft.rules)) : { removed: [], added: [] };
  if (!pointChanged && removed.length === 0 && added.length === 0) return null;
  return {
    path: target.path,
    repository: draft.repository!,
    ...(pointChanged && { point }),
    removedRules: removed,
    addedRules: added,
  };
}

/** The rules to drop and to add to go from `before` to `after`: a rule that changes is in both. */
export function rulesChange(before: readonly XlinkRule[], after: readonly XlinkRule[]): { removed: XlinkRule[]; added: XlinkRule[] } {
  const key = ({ from, to }: XlinkRule) => `${fullBranchName(from)}\n${fullBranchName(to)}`;
  const beforeKeys = new Set(before.map(key));
  const afterKeys = new Set(after.map(key));
  const plain = ({ from, to }: XlinkRule): XlinkRule => ({ from: fullBranchName(from), to: fullBranchName(to) });
  return {
    removed: before.filter((rule) => !afterKeys.has(key(rule))).map(plain),
    added: after.filter((rule) => !beforeKeys.has(key(rule))).map(plain),
  };
}
