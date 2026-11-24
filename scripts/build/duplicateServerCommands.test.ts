import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { needsSignIn } from '../../src/main/cm/repeatedCommands';
import { branchHeadArgs, incomingChangesetsArgs } from '../../src/main/merge/incoming';
import {
  BEFORE_THE_FIRST_STEP,
  commandsByStep,
  duplicateReport,
  duplicatesIn,
  isIncomingCheck,
  needsServer,
  readableCommandLine,
  readCommandLog,
  type CommandLogLine,
  type LoggedStep,
} from './duplicateServerCommands.mts';

const WORKSPACE = join('work', 'demo');
const OTHER_WORKSPACE = join('work', 'other');
const LOCKS = ['lock', 'list', '--anystatus', '--repository=demo@local'];
const BRANCHES = ['find', 'branch', '--format={id}\u001f{name}\u001e'];

function sent(args: string[], cwd = WORKSPACE) {
  return { args, cwd, known: true };
}

function stepOf(...commands: ReturnType<typeof sent>[]): LoggedStep {
  return { step: 'Locks', commands };
}

describe('readCommandLog and commandsByStep', () => {
  it('reads one JSON object a line, CRLF or LF, and groups the commands under the step that sent them', () => {
    const lines: CommandLogLine[] = [sent(['version'], 'home'), { step: 'Open workspace' }, sent(LOCKS), { step: 'Refreshed', rereads: 'Refresh' }, sent(LOCKS)];
    const text = lines.map((line) => JSON.stringify(line)).join('\r\n') + '\n';
    expect(commandsByStep(readCommandLog(text))).toEqual([
      { step: BEFORE_THE_FIRST_STEP, commands: [sent(['version'], 'home')] },
      { step: 'Open workspace', commands: [sent(LOCKS)] },
      { step: 'Refreshed', rereads: 'Refresh', commands: [sent(LOCKS)] },
    ]);
  });

  it('reads an empty log as no commands', () => {
    expect(commandsByStep(readCommandLog(''))).toEqual([{ step: BEFORE_THE_FIRST_STEP, commands: [] }]);
  });
});

describe('needsServer', () => {
  it('counts every command that asks the server', () => {
    expect(needsServer(LOCKS)).toBe(true);
    expect(needsServer(['workspace', 'create', 'demo'])).toBe(true);
  });

  it("leaves out those that only read this machine, and a status that doesn't work out its header", () => {
    for (const args of [['version'], ['wi', WORKSPACE], ['getworkspacefrompath', WORKSPACE], ['workspace', 'list'], ['status', '--compact'], ['status', '--cset'], ['status', '--format={path}']]) {
      expect(needsServer(args)).toBe(false);
    }
  });

  it('counts a status that asks the server for its header', () => {
    expect(needsServer(['status', '--header', '--xml'])).toBe(true);
  });

  it("agrees with the app's own `needsSignIn`, whose list it copies", () => {
    const local = ['getworkspacefrompath', 'gwp', 'wi', 'workspaceinfo', 'lwk', 'profile', 'version', 'location', 'changelist'];
    const commands = [
      ...local.map((command) => [command]),
      ['wk', 'list'],
      ['workspace', 'list'],
      ['workspace', 'create', 'demo'],
      ['wk', 'delete', 'demo'],
      ['status', '--header', '--xml'],
      ['status', '--compact'],
      ['status', '--cset'],
      ['status', '--format={path}'],
      ['find', 'branch'],
      LOCKS,
    ];
    for (const args of commands) expect([args, needsServer(args)]).toEqual([args, needsSignIn(args)]);
  });
});

describe('isIncomingCheck', () => {
  it("knows the incoming check's commands as the app builds them, for a workspace on a changeset and a partial one", () => {
    expect(isIncomingCheck(incomingChangesetsArgs('/main/task-001', 5))).toBe(true);
    expect(isIncomingCheck(branchHeadArgs('/main/task-001'))).toBe(true);
  });

  it("takes other changeset reads for what they are: Incoming's list, a changeset list", () => {
    expect(isIncomingCheck(['find', 'changeset', "where changesetid > 5 and branch = '/main' order by changesetid desc limit 201", '--format={changesetid}\u001f{guid}\u001e'])).toBe(false);
    expect(isIncomingCheck(['find', 'changeset', "where date >= '2026-10-25' order by changesetid desc", '--format={changesetid}\u001f{owner}\u001e'])).toBe(false);
  });

  it('never compares it: the poll and the focus check may run it twice in one step', () => {
    const check = incomingChangesetsArgs('/main/task-001', 5);
    expect(duplicatesIn(stepOf(sent(check), sent(check)))).toEqual([]);
  });
});

describe('duplicatesIn', () => {
  it('finds a server command sent twice from the same folder', () => {
    expect(duplicatesIn(stepOf(sent(LOCKS), sent(BRANCHES), sent(LOCKS)))).toEqual([{ step: 'Locks', commandLine: LOCKS.join(' '), cwd: WORKSPACE, times: 2 }]);
  });

  it('counts every time it was sent', () => {
    expect(duplicatesIn(stepOf(sent(LOCKS), sent(LOCKS), sent(LOCKS)))[0].times).toBe(3);
  });

  it('takes commands whose arguments differ for different commands', () => {
    expect(duplicatesIn(stepOf(sent(LOCKS), sent([...LOCKS, '--smartlocks'])))).toEqual([]);
  });

  it('takes the same command from two folders for two commands: two workspaces each read their own', () => {
    expect(duplicatesIn(stepOf(sent(LOCKS), sent(LOCKS, OTHER_WORKSPACE)))).toEqual([]);
  });

  it('never counts a local command, however often it runs', () => {
    expect(duplicatesIn(stepOf(sent(['version']), sent(['version']), sent(['status', '--compact']), sent(['status', '--compact'])))).toEqual([]);
  });
});

describe('duplicateReport', () => {
  const allowedStatus = { step: 'Locks', command: 'status --header', why: '#349' };

  it('fails on a duplicate no entry allows', () => {
    const report = duplicateReport([stepOf(sent(LOCKS), sent(LOCKS))], []);
    expect(report.failures.map(({ commandLine }) => commandLine)).toEqual([LOCKS.join(' ')]);
  });

  it('passes a duplicate an entry allows, by how its command line starts', () => {
    const steps = [stepOf(sent(['status', '--header', '--xml']), sent(['status', '--header', '--xml']))];
    expect(duplicateReport(steps, [allowedStatus])).toEqual({ failures: [], unused: [] });
  });

  it('fails on an allowed duplicate in another step than the one its entry names, and names the entry unused', () => {
    const status = ['status', '--header', '--xml'];
    const report = duplicateReport([{ step: 'Changes', commands: [sent(status), sent(status)] }], [allowedStatus]);
    expect(report.failures.map(({ step }) => step)).toEqual(['Changes']);
    expect(report.unused).toEqual([allowedStatus]);
  });

  it('names an allowed entry that matched nothing, so it can go, without failing', () => {
    expect(duplicateReport([stepOf(sent(LOCKS))], [allowedStatus])).toEqual({ failures: [], unused: [allowedStatus] });
  });

  it("skips a step that says what reads again: an operation's or a refresh's reads are meant", () => {
    const refreshed: LoggedStep = { step: 'Refreshed', rereads: 'Refresh', commands: [sent(LOCKS), sent(LOCKS)] };
    expect(duplicateReport([refreshed], [])).toEqual({ failures: [], unused: [] });
  });

  it('counts each step apart: a command sent once in each of two steps is no duplicate', () => {
    expect(duplicateReport([stepOf(sent(LOCKS)), { step: 'Changes', commands: [sent(LOCKS)] }], []).failures).toEqual([]);
  });
});

describe('readableCommandLine', () => {
  it("shows --format's field separators", () => {
    expect(readableCommandLine(BRANCHES.join(' '))).toBe('find branch --format={id}|{name}|');
  });
});
