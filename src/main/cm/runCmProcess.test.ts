import { describe, expect, it } from 'vitest';
import { runCmProcess } from './runCmProcess';

describe('runCmProcess', () => {
  it('keeps a character whole when its bytes arrive in two chunks', async () => {
    // "ñ" is two bytes in UTF-8: the script writes the first, waits, then writes the second.
    const script = 'process.stdout.write(Buffer.from([0x61, 0xc3])); setTimeout(() => process.stdout.write(Buffer.from([0xb1, 0x0a])), 50);';
    const result = await runCmProcess(process.execPath, ['-e', script], {});

    expect(result).toEqual({ output: 'añ\n', exitCode: 0 });
  });
});
