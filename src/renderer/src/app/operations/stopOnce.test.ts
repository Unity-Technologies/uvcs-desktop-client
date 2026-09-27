import { describe, expect, it } from 'vitest';
import { stopOnce } from './stopOnce';

describe('stopOnce', () => {
  it('asks the operation to stop once however often Cancel is pressed, and says it is stopping', () => {
    const calls: string[] = [];
    const cancel = stopOnce(
      () => calls.push('stop'),
      () => calls.push('stopping'),
    );
    cancel();
    cancel();
    cancel();
    expect(calls).toEqual(['stop', 'stopping']);
  });
});
