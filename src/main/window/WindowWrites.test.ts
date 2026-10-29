import { describe, expect, it } from 'vitest';
import { WindowWrites } from './WindowWrites';

/** An operation that runs until the test ends it. */
function operation() {
  let succeed!: () => void;
  let fail!: () => void;
  const finished = new Promise<void>((resolve, reject) => ((succeed = resolve), (fail = () => reject(new Error('failed')))));
  finished.catch(() => {});
  return { finished, succeed, fail };
}

/** Lets settled operations be forgotten. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('WindowWrites', () => {
  it("counts an operation in the window that started it, not in the others", () => {
    const writes = new WindowWrites();
    writes.started(1, operation().finished);

    expect(writes.runningIn([1])).toBe(true);
    expect(writes.runningIn([2])).toBe(false);
    expect(writes.runningIn([2, 1])).toBe(true);
  });

  it('forgets an operation once it ends, whether it succeeded or failed', async () => {
    const writes = new WindowWrites();
    const update = operation();
    const checkin = operation();
    writes.started(1, update.finished);
    writes.started(1, checkin.finished);

    update.succeed();
    await settle();
    expect(writes.runningIn([1])).toBe(true);
    checkin.fail();
    await settle();
    expect(writes.runningIn([1])).toBe(false);
  });

  it("settles once the windows' operations end, including one started while waiting", async () => {
    const writes = new WindowWrites();
    const update = operation();
    const merge = operation();
    writes.started(1, update.finished);
    let done = false;
    void writes.finishedIn([1, 2]).then(() => (done = true));

    writes.started(2, merge.finished);
    update.succeed();
    await settle();
    expect(done).toBe(false);
    merge.fail();
    await settle();
    expect(done).toBe(true);
  });

  it("settles at once when none of the windows started one, whatever other windows run", async () => {
    const writes = new WindowWrites();
    writes.started(2, operation().finished);

    await expect(writes.finishedIn([1])).resolves.toBeUndefined();
  });
});
