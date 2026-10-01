import { describe, expect, it } from 'vitest';
import { runCmProcess } from './runCmProcess';

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
