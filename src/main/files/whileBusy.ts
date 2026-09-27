/** What Windows answers while another program (an editor, the Unity Editor, an antivirus scan) has the file open. */
const BUSY_CODES = new Set(['EBUSY', 'EPERM', 'EACCES']);
const RETRY_DELAYS_MS = [50, 100, 200, 400, 800];

/**
 * Runs a file operation, trying again for a moment while Windows says the file is in use: a program holding it open
 * blocks renaming, deleting and often writing it there, usually for a moment only. Elsewhere those errors are final.
 */
export async function retryWhileBusy<T>(
  work: () => Promise<T>,
  platform: NodeJS.Platform = process.platform,
  delays: readonly number[] = RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (platform !== 'win32' || !BUSY_CODES.has(code) || attempt >= delays.length) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}
