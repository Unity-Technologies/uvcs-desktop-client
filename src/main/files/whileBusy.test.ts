import { describe, expect, it } from 'vitest';
import { retryWhileBusy } from './whileBusy';

/** Fails with `code` the first `times` calls, then succeeds. */
function flaky(code: string, times: number) {
  let calls = 0;
  const work = async () => {
    calls++;
    if (calls <= times) throw Object.assign(new Error(code), { code });
    return 'done';
  };
  return { work, calls: () => calls };
}

describe('retryWhileBusy', () => {
  it('tries again on Windows while another program has the file open', async () => {
    const { work, calls } = flaky('EBUSY', 2);
    await expect(retryWhileBusy(work, 'win32', [0, 0, 0])).resolves.toBe('done');
    expect(calls()).toBe(3);
  });

  it('gives up once the delays are used up', async () => {
    const { work, calls } = flaky('EPERM', 5);
    await expect(retryWhileBusy(work, 'win32', [0, 0])).rejects.toThrow('EPERM');
    expect(calls()).toBe(3);
  });

  it('fails at once elsewhere, and on Windows for anything but a file in use', async () => {
    const onMac = flaky('EBUSY', 1);
    await expect(retryWhileBusy(onMac.work, 'darwin', [0])).rejects.toThrow('EBUSY');
    const onLinux = flaky('EACCES', 1);
    await expect(retryWhileBusy(onLinux.work, 'linux', [0])).rejects.toThrow('EACCES');
    const missing = flaky('ENOENT', 1);
    await expect(retryWhileBusy(missing.work, 'win32', [0])).rejects.toThrow('ENOENT');
    expect(onMac.calls() + onLinux.calls() + missing.calls()).toBe(3);
  });
});
