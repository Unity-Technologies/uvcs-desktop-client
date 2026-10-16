import { describe, expect, it } from 'vitest';
import { RecordReader } from './formatRecords';
import { runCmProcess } from './runCmProcess';
import { formatOutput } from './testing/cmOutput';

/** Runs a Node script standing in for `cm`. */
const runScript = (script: string, onOutputLine?: (line: string) => void) => runCmProcess(process.execPath, ['-e', script], { onOutputLine });

describe('runCmProcess', () => {
  it('keeps a character whole when its bytes arrive in two chunks', async () => {
    const script = "const b = Buffer.from('é\\n'); process.stdout.write(b.subarray(0, 1)); setTimeout(() => process.stdout.write(b.subarray(1)), 100);";
    const lines: string[] = [];
    await expect(runScript(script, (line) => lines.push(line))).resolves.toEqual({ output: 'é\n', exitCode: 0 });
    expect(lines).toEqual(['é']);
  });

  it('reports lines ended by a line break or rewritten with \\r, and the last one unended', async () => {
    const lines: string[] = [];
    const result = await runScript("process.stdout.write('a\\r\\nb\\rc\\nd')", (line) => lines.push(line));
    expect(lines).toEqual(['a', 'b', 'c', 'd']);
    expect(result.exitCode).toBe(0);
  });

  it("gives Windows line breaks as the app's, and leaves the \\r of a rewritten line", async () => {
    await expect(runScript("process.stdout.write('a\\r\\nb\\rc\\r\\n')")).resolves.toEqual({ output: 'a\nb\rc\n', exitCode: 0 });
  });

  it('hands the command its input and closes it', async () => {
    const script = "let text = ''; process.stdin.on('data', (d) => (text += d)).on('end', () => process.stdout.write(text.toUpperCase()));";
    await expect(runCmProcess(process.execPath, ['-e', script], { input: 'a b\n' })).resolves.toEqual({ output: 'A B\n', exitCode: 0 });
  });

  it('stops a command whose output passes the limit, which it fails', async () => {
    // Joined into one string at the end, past V8's limit it would throw where nothing catches it.
    const script = "process.stdout.write('x'.repeat(5000)); setInterval(() => process.stdout.write('x'), 10);";
    await expect(runCmProcess(process.execPath, ['-e', script], { maxOutputLength: 1000 })).rejects.toThrow('printed more than 1000 characters');
  });
});

describe('runCmProcess reading records', () => {
  /** A Node script standing in for `cm`, printing `output` in two writes cut at byte `cut`, then exiting with `exitCode`. */
  const printing = (output: string, cut: number, exitCode = 0): string =>
    `const b = Buffer.from(${JSON.stringify(output)}); process.stdout.write(b.subarray(0, ${cut})); process.stdout.write(b.subarray(${cut}), () => process.exit(${exitCode}));`;

  it('reads the records a command prints, a character split between its writes kept whole', async () => {
    const output = formatOutput(['1', 'Ñandú']).replaceAll('\n', '\r\n');
    const records = new RecordReader((fields) => fields);

    const result = await runCmProcess(process.execPath, ['-e', printing(output, Buffer.from('1\u001fÑ').length - 1)], { records });

    expect(result).toEqual({ output: '', exitCode: 0 });
    expect(records.finish(result.output)).toEqual([['1', 'Ñandú']]);
  });

  it('gives what a failed command printed besides its records as its output', async () => {
    const records = new RecordReader((fields) => fields);
    const error = "Error: The branch 'br:/main/gone' does not exist.\r\n";

    await expect(runCmProcess(process.execPath, ['-e', printing(error, 5, 1)], { records })).resolves.toEqual({
      output: "Error: The branch 'br:/main/gone' does not exist.\n",
      exitCode: 1,
    });
    expect(records.count).toBe(0);
  });

  it('stops a command whose records pass the limit, which it fails', async () => {
    const script = "process.stdout.write('1\\u001e\\n'.repeat(2000)); setInterval(() => process.stdout.write('1\\u001e\\n'), 10);";
    const records = new RecordReader((fields) => fields);
    await expect(runCmProcess(process.execPath, ['-e', script], { records, maxOutputLength: 1000 })).rejects.toThrow('printed more than 1000 characters');
  });

  it('fails a command whose records its caller cannot read, instead of never ending', async () => {
    const script = "process.stdout.write('1\\u001e\\n'); setInterval(() => process.stdout.write('1\\u001e\\n'), 10);";
    const records = new RecordReader(() => {
      throw new Error('Not a record');
    });
    await expect(runCmProcess(process.execPath, ['-e', script], { records })).rejects.toThrow('Not a record');
  });
});
