/** Whether a process is running: signal 0 checks without sending one (`EPERM`: it runs, as another user's). */
export function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
