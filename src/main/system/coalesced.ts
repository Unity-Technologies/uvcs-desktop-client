type Schedule = (run: () => void) => void;

/**
 * `run` once for each burst of calls: the first call schedules it (by default for once the current I/O and timers
 * are handled, `setImmediate`), and the calls that come before it runs join that run.
 */
export function coalesced(run: () => void, schedule: Schedule = setImmediate): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      run();
    });
  };
}
