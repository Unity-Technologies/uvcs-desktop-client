import { describe, expect, it } from 'vitest';
import type { XlinkTarget } from '@shared/domain/explorer';
import {
  draftOf,
  newXlinkOf,
  pointOf,
  rulesChange,
  withNewRule,
  withoutRule,
  withPointKind,
  withRuleChange,
  xlinkDialogFields,
  xlinkEditOf,
  type XlinkDialogTarget,
  type XlinkDraft,
} from './xlinkDraft';

const CREATE: XlinkDialogTarget = { kind: 'create', directory: 'code', siblings: ['Engine', 'README.md'] };
const WRITABLE: XlinkTarget = { writable: true, path: '/', changeset: 17, repository: 'lib', server: 'acme@cloud' };
const READ_ONLY: XlinkTarget = { writable: false, path: '/sub', changeset: 4, repository: 'art', server: 'local' };

const edit = (xlink: XlinkTarget, rules = [{ from: '/main', to: '/main/dev', userDefined: true }]): Extract<XlinkDialogTarget, { kind: 'edit' }> => ({
  kind: 'edit',
  path: 'code/lib',
  name: 'lib',
  xlink,
  rules,
});

/** A new xlink's draft, filled in enough to create it. */
const filled = (changes: Partial<XlinkDraft> = {}): XlinkDraft => ({ ...draftOf(CREATE), name: 'lib', repository: 'lib@local', ...changes });

describe('A new xlink', () => {
  it('starts on the main branch of a repository yet to choose, read-only and showing all of it', () => {
    const draft = draftOf(CREATE);

    expect(draft).toMatchObject({ pointKind: 'branch', point: '/main', writable: false, folder: '/', rules: [] });
    expect(xlinkDialogFields(CREATE, draft).problem).toBe('Name its folder');
  });

  it('asks for its repository, then can be created', () => {
    expect(xlinkDialogFields(CREATE, filled({ repository: null })).problem).toBe('Choose its repository');
    expect(xlinkDialogFields(CREATE, filled()).problem).toBeNull();
  });

  it('takes no name already in its folder, whatever its case, nor a path', () => {
    expect(xlinkDialogFields(CREATE, filled({ name: 'engine' })).nameError).toBe('“Engine” already exists here');
    expect(xlinkDialogFields(CREATE, filled({ name: 'a/b' })).nameError).toBe('A name can’t contain “/”');
  });

  it('shows a folder of its repository only while read-only, and rules only once writable', () => {
    expect(xlinkDialogFields(CREATE, filled())).toMatchObject({ showsFolder: true, showsRules: false });
    expect(xlinkDialogFields(CREATE, filled({ writable: true }))).toMatchObject({ showsFolder: false, showsRules: true });
  });

  it('is created in its folder with what was typed, a branch named without its slash too', () => {
    const draft = withRuleChange(withNewRule(filled({ writable: true, point: 'main/dev', folder: '/sub' })), 0, { from: 'main/task', to: '/main/dev' });

    expect(newXlinkOf('code', draft)).toEqual({
      path: 'code/lib',
      repository: 'lib@local',
      point: { kind: 'branch', branch: '/main/dev' },
      writable: true,
      relativeServer: false,
      folder: '/',
      rules: [{ from: '/main/task', to: '/main/dev' }],
    });
  });

  it('is created at the root, read-only, with the folder of its repository and no rules', () => {
    const draft = withRuleChange(withNewRule(filled({ folder: '/Assets' })), 0, { from: '/main', to: '/main' });

    expect(newXlinkOf('', draft)).toMatchObject({ path: 'lib', folder: '/Assets', rules: [] });
  });
});

describe('Where an xlink points', () => {
  it('is a changeset number, or a branch or label by name', () => {
    expect(pointOf({ pointKind: 'changeset', point: ' 42 ' })).toEqual({ kind: 'changeset', changeset: 42 });
    expect(pointOf({ pointKind: 'branch', point: '/main/task 1' })).toEqual({ kind: 'branch', branch: '/main/task 1' });
    expect(pointOf({ pointKind: 'label', point: 'v1.2' })).toEqual({ kind: 'label', label: 'v1.2' });
  });

  it('says what is wrong once something is typed, never before', () => {
    expect(xlinkDialogFields(CREATE, filled({ pointKind: 'changeset', point: 'cs:4' })).pointError).toBe('A changeset number, like 17');
    expect(xlinkDialogFields(CREATE, filled({ pointKind: 'label', point: 'v1@lib@local' })).pointError).toBe('Only the name: the repository is chosen above');
    const empty = xlinkDialogFields(CREATE, filled({ pointKind: 'label', point: '' }));
    expect(empty.pointError).toBeUndefined();
    expect(empty.problem).toBe('Name its label');
  });

  it('starts a branch on the main one, and an edited xlink’s changeset where it points', () => {
    expect(withPointKind(CREATE, filled({ pointKind: 'label', point: 'v1' }), 'branch')).toMatchObject({ pointKind: 'branch', point: '/main' });
    expect(withPointKind(CREATE, filled(), 'changeset').point).toBe('');
    const target = edit(WRITABLE);
    expect(withPointKind(target, withPointKind(target, draftOf(target), 'label'), 'changeset').point).toBe('17');
  });

  it('names its field after the kind of point, a branch’s telling it stays on its latest changeset', () => {
    expect(xlinkDialogFields(CREATE, filled()).pointHint).toMatch(/latest changeset/);
    expect(xlinkDialogFields(CREATE, filled({ pointKind: 'changeset' }))).toMatchObject({ pointLabel: 'Changeset', pointHint: undefined });
  });
});

describe('Branch expansion rules', () => {
  it('need both branches, and one rule per branch of the workspace', () => {
    let draft = withNewRule(withNewRule(withNewRule(filled({ writable: true }))));
    draft = withRuleChange(draft, 0, { from: '/main', to: '/main/dev' });
    draft = withRuleChange(draft, 1, { from: 'main', to: '/main/x' });
    draft = withRuleChange(draft, 2, { from: '/main/task' });

    const fields = xlinkDialogFields(CREATE, draft);

    expect([...fields.ruleNotes]).toEqual([
      [1, { text: '/main has a rule already', isError: true }],
      [2, { text: 'Name both branches', isError: true }],
    ]);
    expect(fields.problem).toBe('/main has a rule already');
  });

  it('leave out an empty row, and a removed one', () => {
    const draft = withoutRule(withRuleChange(withNewRule(withNewRule(filled({ writable: true }))), 1, { from: '/a', to: '/b' }), 1);

    expect(xlinkDialogFields(CREATE, draft).problem).toBeNull();
    expect(newXlinkOf('code', draft).rules).toEqual([]);
  });

  it('keep each row’s key as rows go, so a field keeps what is typed in it', () => {
    const draft = withNewRule(withoutRule(withNewRule(withNewRule(filled({ writable: true }))), 0));

    expect(draft.rules.map((rule) => rule.key)).toEqual([1, 2]);
  });

  it('are dropped and added again when they change: cm refuses a second rule for a branch', () => {
    const before = [
      { from: '/main', to: '/main/dev' },
      { from: '/main/task', to: '/main/x' },
    ];
    const after = [
      { from: 'main', to: '/main/dev' },
      { from: '/main/task', to: '/main/y' },
      { from: '/release', to: '/main' },
    ];

    expect(rulesChange(before, after)).toEqual({
      removed: [{ from: '/main/task', to: '/main/x' }],
      added: [
        { from: '/main/task', to: '/main/y' },
        { from: '/release', to: '/main' },
      ],
    });
  });
});

describe('Editing an xlink', () => {
  it('starts where it points, with its rules, cm’s own marked until edited', () => {
    const target = edit(WRITABLE, [
      { from: '/main', to: '/main/dev', userDefined: true },
      { from: '/main/fix', to: '/main/fix', userDefined: false },
    ]);
    const draft = draftOf(target);

    expect(draft).toMatchObject({ repository: 'lib@acme@cloud', pointKind: 'changeset', point: '17', writable: true });
    expect(draft.rules.map((rule) => rule.automatic)).toEqual([false, true]);
    expect([...xlinkDialogFields(target, draft).ruleNotes]).toEqual([[1, { text: 'Added when a change made in the xlink created its branch', isError: false }]]);
    expect(withRuleChange(draft, 1, { to: '/main/hotfix' }).rules[1]!.automatic).toBe(false);
  });

  it('can’t be saved until something changes', () => {
    const target = edit(WRITABLE);

    expect(xlinkDialogFields(target, draftOf(target)).problem).toBe('Nothing changed');
    expect(xlinkEditOf(target, { ...draftOf(target), point: ' 17' })).toBeNull();
  });

  it('points elsewhere: another changeset, or a branch’s latest one', () => {
    const target = edit(WRITABLE);

    expect(xlinkEditOf(target, { ...draftOf(target), point: '20' })).toEqual({
      path: 'code/lib',
      repository: 'lib@acme@cloud',
      point: { kind: 'changeset', changeset: 20 },
      removedRules: [],
      addedRules: [],
    });
    expect(xlinkEditOf(target, { ...draftOf(target), pointKind: 'branch', point: '/main' })?.point).toEqual({ kind: 'branch', branch: '/main' });
  });

  it('changes only its rules, leaving where it points', () => {
    const target = edit(WRITABLE);
    const draft = withRuleChange(draftOf(target), 0, { to: '/main/x' });

    expect(xlinkEditOf(target, draft)).toEqual({
      path: 'code/lib',
      repository: 'lib@acme@cloud',
      removedRules: [{ from: '/main', to: '/main/dev' }],
      addedRules: [{ from: '/main', to: '/main/x' }],
    });
  });

  it('names what kind of xlink it is and where it points, and keeps what cm can’t change out of reach', () => {
    const target = edit(READ_ONLY, []);
    const fields = xlinkDialogFields(target, draftOf(target));

    expect(fields).toMatchObject({ title: 'Edit xlink lib', isNew: false, showsFolder: false, showsRules: false, saveLabel: 'Save' });
    expect(fields.description).toBe('Read-only xlink to art@local /sub. Saving checks it out: check it in to share it.');
  });
});
