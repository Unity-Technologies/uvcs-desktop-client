import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CmShellSession, shellCommandTimeoutMs } from './CmShellSession';
import { FIELD_SEPARATOR, RecordReader, RECORD_SEPARATOR } from './formatRecords';
import { OutputBuffer } from './OutputBuffer';
import { formatOutput } from './testing/cmOutput';

// Every session runs the fake below, but one test's, whose output comes in step with fake timers.
vi.mock('node:child_process', async (importOriginal) => {
  const childProcess = await importOriginal<typeof import('node:child_process')>();
  return { ...childProcess, spawn: vi.fn(childProcess.spawn) };
});

// `node shell` in the fake's folder, as the session runs `<cm> shell`.
const fakeCmFolder = fileURLToPath(new URL('./testing/fakeCmShell', import.meta.url));
let session: CmShellSession;

afterEach(() => {
  session?.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A `cm shell` process whose output the test prints, as it pleases. */
function printedShellProcess() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const stdin = Object.assign(new EventEmitter(), { write: () => true, end: () => {} });
  const process = Object.assign(new EventEmitter(), { stdout, stderr, stdin, kill: () => true });
  return {
    process: process as unknown as ChildProcessWithoutNullStreams,
    print: (output: string | Buffer) => void stdout.emit('data', Buffer.isBuffer(output) ? output : Buffer.from(output, 'utf8')),
    breakInput: (error: Error) => void stdin.emit('error', error),
  };
}

describe('CmShellSession', () => {
  it('runs commands in order and reports their exit codes', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const [first, second] = await Promise.all([session.run(['echo', 'hello']), session.run(['fail'])]);
    expect(first).toEqual({ output: 'hello', exitCode: 0 });
    expect(second.exitCode).toBe(1);
  });

  it('fails a command stuck on a prompt without feeding it the next commands', async () => {
    // Nothing follows the fake's prompt, so any stall tells it; the real one would only make the test wait.
    session = new CmShellSession(process.execPath, fakeCmFolder, { promptStallMs: 50 });
    const prompted = session.run(['prompt']);
    const next = session.run(['echo', 'still-works']);

    await expect(prompted).rejects.toThrow(/waiting for input/);
    await expect(next).resolves.toEqual({ output: 'still-works', exitCode: 0 });
  });

  it('reads Windows line breaks as the app\'s, the one before the result line included', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    await expect(session.run(['crlf', 'first'])).resolves.toEqual({ output: 'first\nsecond line', exitCode: 0 });
  });

  it('ends a command at its last result line, not at one quoted in its output', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const [quoted, next] = await Promise.all([session.run(['quote']), session.run(['echo', 'in-step'])]);
    expect(quoted).toEqual({ output: '>cm shell\nCommandResult 0\nstill the comment', exitCode: 0 });
    expect(next).toEqual({ output: 'in-step', exitCode: 0 });
  });

  it('fails the running command when cm shell ends, and runs the next ones on a new process', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const ended = session.run(['exit']);
    const next = session.run(['echo', 'restarted']);

    await expect(ended).rejects.toThrow('cm shell exited unexpectedly');
    await expect(next).resolves.toEqual({ output: 'restarted', exitCode: 0 });
  });

  it('fails a command whose output passes the limit, and runs the next ones on a new process', async () => {
    // A cm shell answer is read as one string, and V8 refuses strings past 512 MB: past the limit it is no answer.
    session = new CmShellSession(process.execPath, fakeCmFolder, { maxOutputLength: 1000 });
    const withinLimit = session.run(['print', '900']);
    const tooLarge = session.run(['print', '5000']);
    const next = session.run(['echo', 'recovered']);

    await expect(withinLimit).resolves.toMatchObject({ exitCode: 0 });
    await expect(tooLarge).rejects.toThrow('printed more than 1000 characters');
    await expect(next).resolves.toEqual({ output: 'recovered', exitCode: 0 });
  });

  it('fails the running command when reading its output throws, instead of crashing the app, and runs the next on a new process', async () => {
    // The end of a command is read on a later turn of the event loop (`setImmediate`), where no promise would catch a
    // throw: Electron would show it in its own "A JavaScript error occurred in the main process" dialog.
    vi.spyOn(OutputBuffer.prototype, 'textBefore').mockImplementationOnce(() => {
      throw new RangeError('Invalid string length');
    });
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const failed = session.run(['echo', 'huge']);
    const next = session.run(['echo', 'recovered']);

    await expect(failed).rejects.toThrow('Invalid string length');
    await expect(next).resolves.toEqual({ output: 'recovered', exitCode: 0 });
  });

  it('fails the running command when its input pipe breaks, instead of crashing the app', async () => {
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const broken = session.run(['status']);

    shell.breakInput(new Error('write EPIPE'));

    await expect(broken).rejects.toThrow('write EPIPE');
  });

  it('stops a read that takes longer than two minutes', async () => {
    vi.useFakeTimers();
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const stuck = session.run(['find', 'changeset']);
    shell.print('Searching...\n');

    vi.advanceTimersByTime(shellCommandTimeoutMs(['find', 'changeset']));

    await expect(stuck).rejects.toThrow('took too long');
  });

  it('does not take output paused on a colon for a prompt while the main process is busy', async () => {
    vi.useFakeTimers();
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const paused = session.run(['status']);
    shell.print('2026-09-25T10:');

    // Busy past the prompt stall (e.g. parsing a huge output): the rest of the line arrives meanwhile, and on the next
    // turn of the event loop the stall's timer fires before it is read.
    vi.advanceTimersToNextTimer();
    shell.print('11:12\nCommandResult 0\n');
    await vi.runOnlyPendingTimersAsync();

    await expect(paused).resolves.toEqual({ output: '2026-09-25T10:11:12', exitCode: 0 });
  });
});

describe('CmShellSession reading records', () => {
  const asFields = () => new RecordReader<string[]>((fields) => fields);
  const tasks = (count: number) => Array.from({ length: count }, (_, id) => [String(id), `/main/tarea-ñ-${id}`]);

  it.each(['lf', 'crlf'])('reads the records a command prints, with %s line breaks, and leaves nothing as its output', async (lineBreaks) => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const records = asFields();

    const result = await session.run(['records', '3', lineBreaks], records);

    expect(result).toEqual({ output: '', exitCode: 0 });
    expect(records.finish(result.output)).toEqual(tasks(3));
  });

  it('reads records in many chunks, and the commands after them in step', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const records = asFields();

    const [result, next] = await Promise.all([session.run(['records', '20000'], records), session.run(['echo', 'in-step'])]);

    expect(result.exitCode).toBe(0);
    expect(records.finish(result.output)).toEqual(tasks(20_000));
    expect(next).toEqual({ output: 'in-step', exitCode: 0 });
  });

  it("gives a failed command's error as its output", async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const records = asFields();

    await expect(session.run(['fail'], records)).resolves.toEqual({ output: 'Something went wrong', exitCode: 1 });
    expect(records.count).toBe(0);
  });

  it('reads each record as it arrives, wherever the chunks end, the result line split too', async () => {
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const records = asFields();
    const finished = session.run(['find', 'branch'], records);
    const printed = `${formatOutput(['1', '/main/tarea-ñ'], ['2', '"quoted"'])}CommandResult 0\n`;
    const output = Buffer.from(printed.replaceAll('\n', '\r\n'));
    // Inside the ñ, after the first record's separator, between CR and LF, inside the quotes, inside the result line.
    const cuts = [output.indexOf('ñ') + 1, output.indexOf(RECORD_SEPARATOR) + 1, output.indexOf('\n'), output.indexOf('"') + 2, output.indexOf('Result')];

    [0, ...cuts].forEach((start, index) => shell.print(output.subarray(start, cuts[index] ?? output.length)));
    // The records were read as they came, before the output ended.
    expect(records.count).toBe(2);

    await expect(finished).resolves.toEqual({ output: '', exitCode: 0 });
    expect(records.finish('')).toEqual([
      ['1', '/main/tarea-ñ'],
      ['2', 'quoted'],
    ]);
  });

  it('ends a command at its last result line, not at one quoted in a record', async () => {
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const records = asFields();
    const finished = session.run(['find', 'changeset'], records);

    // A comment quoting a `cm shell` session ends a chunk; the rest of the record is already waiting in the pipe.
    shell.print(`1${FIELD_SEPARATOR}>cm shell\nCommandResult 0\n`);
    shell.print(`still the comment${RECORD_SEPARATOR}\nCommandResult 0\n`);

    await expect(finished).resolves.toEqual({ output: '', exitCode: 0 });
    expect(records.finish('')).toEqual([['1', '>cm shell\nCommandResult 0\nstill the comment']]);
  });

  it('fails a command whose records pass the limit, counted in bytes, and runs the next ones on a new process', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder, { maxOutputLength: 1000 });
    const tooLarge = session.run(['records', '200'], asFields());
    const next = session.run(['echo', 'recovered']);

    await expect(tooLarge).rejects.toThrow('printed more than 1000 characters');
    await expect(next).resolves.toEqual({ output: 'recovered', exitCode: 0 });
  });

  it('fails a command whose records its caller cannot read, and runs the next ones on a new process', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const unreadable = new RecordReader(() => {
      throw new Error('Not a record');
    });
    const failed = session.run(['records', '3'], unreadable);
    const next = session.run(['echo', 'recovered']);

    await expect(failed).rejects.toThrow('Not a record');
    await expect(next).resolves.toEqual({ output: 'recovered', exitCode: 0 });
  });

  it('fails a command stuck on a prompt while its records were expected', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder, { promptStallMs: 50 });
    await expect(session.run(['prompt'], asFields())).rejects.toThrow('cm is waiting for input ("Select your system [0-1]:")');
  });
});

describe('shellCommandTimeoutMs', () => {
  it('gives writes to thousands of files minutes, where a read gets two', () => {
    expect(shellCommandTimeoutMs(['status', '--xml'])).toBe(120_000);
    expect(shellCommandTimeoutMs(['undo', '-r', '/wk'])).toBeGreaterThanOrEqual(30 * 60_000);
    expect(shellCommandTimeoutMs(['add', '--coparent', '/wk/a'])).toBeGreaterThanOrEqual(30 * 60_000);
  });
});
