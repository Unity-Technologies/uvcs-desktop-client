import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticLog, MAX_RECORD_LENGTH, type LogFiles } from './DiagnosticLog';
import { earlierLogFiles } from './logRotation';

const NOW = new Date(Date.UTC(2026, 10, 17, 11, 40, 36, 123));

let folder: string;
let file: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'diagnostic-log-'));
  file = join(folder, 'logs', 'uvcs-desktop.log');
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

/** Files in memory, whose renames fail with `failing`'s code while it names their source. */
function memoryFiles(): { files: LogFiles; contents: Map<string, string>; failing: Map<string, string> } {
  const contents = new Map<string, string>();
  const failing = new Map<string, string>();
  const files: LogFiles = {
    size: async (path) => Buffer.byteLength(contents.get(path) ?? ''),
    append: async (path, text) => void contents.set(path, (contents.get(path) ?? '') + text),
    rename: async (from, to) => {
      const code = failing.get(from) ?? (contents.has(from) ? undefined : 'ENOENT');
      if (code) throw Object.assign(new Error(`${code}: rename ${from}`), { code });
      contents.set(to, contents.get(from)!);
      contents.delete(from);
    },
  };
  return { files, contents, failing };
}

function textsOf(text: string | undefined): string[] {
  return (text ?? '').split('\n').filter(Boolean).map((line) => line.replace(/^\S+ \S+ [+-]\d\d:\d\d /, ''));
}

function logTo(parts: { maxBytes?: number; files?: LogFiles } = {}): DiagnosticLog {
  return new DiagnosticLog({ file, maxBytes: parts.maxBytes ?? 1_000_000, keptFiles: 2, now: () => NOW, ...(parts.files && { files: parts.files }) });
}

/** The texts of the file's records, without their times. */
async function recordsIn(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8');
  return text.split('\n').filter(Boolean).map((line) => line.replace(/^\S+ \S+ [+-]\d\d:\d\d /, ''));
}

describe('DiagnosticLog', () => {
  it('appends each record on its own line, making the logs folder when it isn’t there yet', async () => {
    const log = logTo();
    log.write('Started');
    log.write('cm status · 12 ms');
    await log.flushed();
    log.write('cm find branch · 40 ms');
    await log.flushed();

    expect(await recordsIn(file)).toEqual(['Started', 'cm status · 12 ms', 'cm find branch · 40 ms']);
  });

  it('never lets a password reach the file', async () => {
    const log = logTo();
    log.write('cm sync rep@srv git https://ana:s3cret@github.com/a/b.git --user=ana --pwd=hunter2 · Exit code 1');
    await log.flushed();

    const text = await readFile(file, 'utf8');
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('s3cret');
    expect(text).toContain('--pwd=•••');
  });

  it('starts a new file past its size, keeping the earlier ones and dropping the oldest', async () => {
    const [first, second] = earlierLogFiles(file, 2);
    // Each record is about 36 bytes, its time included: two fit in a file, the third starts the next one.
    const log = logTo({ maxBytes: 100 });
    for (const text of ['one', 'two', 'three', 'four', 'five', 'six', 'seven']) {
      log.write(text);
      await log.flushed();
    }

    expect(await recordsIn(file)).toEqual(['seven']);
    expect(await recordsIn(first!)).toEqual(['five', 'six']);
    expect(await recordsIn(second!)).toEqual(['three', 'four']);
  });

  it('goes on after a write that failed, without throwing at the caller', async () => {
    let failing = true;
    const files: LogFiles = {
      size: async () => 0,
      append: async (path, text) => {
        if (failing) throw new Error('EACCES: permission denied');
        await mkdir(join(folder, 'logs'), { recursive: true });
        await appendFile(path, text);
      },
      rename: async () => undefined,
    };
    const log = logTo({ files });
    expect(() => log.write('lost')).not.toThrow();
    await log.flushed();
    failing = false;
    log.write('kept');
    await log.flushed();

    expect(await recordsIn(file)).toEqual(['kept']);
  });

  it('clips a record past its length, keeping its start and its end, so none takes the file by itself', async () => {
    const log = logTo();
    log.write(`Error: boom\n${'    at frame (a.ts:1)\n'.repeat(20_000)}    at last (z.ts:9)`);
    await log.flushed();

    // Its own characters: without its time and the indent its later lines take.
    const text = (await readFile(file, 'utf8')).replace(/^\S+ \S+ \S+ /, '').replaceAll('\n    ', '\n');
    expect(text.length).toBeLessThan(MAX_RECORD_LENGTH + 100);
    expect(text).toContain('Error: boom');
    expect(text).toContain('at last (z.ts:9)');
  });

  it('keeps writing to the current file while it can’t be moved, and moves it on the next write once it can', async () => {
    const { files, contents, failing } = memoryFiles();
    const [first] = earlierLogFiles(file, 2);
    const log = logTo({ maxBytes: 100, files });
    log.write('one');
    log.write('two');
    await log.flushed();
    failing.set(file, 'EBUSY');
    log.write('three');
    await log.flushed();
    failing.clear();
    log.write('four');
    await log.flushed();

    expect(textsOf(contents.get(file))).toEqual(['four']);
    expect(textsOf(contents.get(first!))).toEqual(['one', 'two', 'three']);
  });

  it('overwrites no earlier file when an older one can’t be moved', async () => {
    const { files, contents, failing } = memoryFiles();
    const [first, second] = earlierLogFiles(file, 2);
    contents.set(first!, 'earlier\n');
    contents.set(second!, 'oldest\n');
    contents.set(file, 'x'.repeat(99) + '\n');
    failing.set(first!, 'EPERM');
    const log = logTo({ maxBytes: 100, files });
    log.write('new');
    await log.flushed();

    expect(contents.get(first!)).toBe('earlier\n');
    expect(contents.get(second!)).toBe('oldest\n');
    expect(textsOf(contents.get(file))).toEqual(['x'.repeat(99), 'new']);
  });
});
