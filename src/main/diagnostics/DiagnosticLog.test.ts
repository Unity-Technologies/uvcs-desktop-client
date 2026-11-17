import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticLog, type LogFiles } from './DiagnosticLog';
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
});
