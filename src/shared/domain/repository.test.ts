import { describe, expect, it } from 'vitest';
import { otherRepository } from './repository';

describe('otherRepository', () => {
  it("names the xlinked repository an item lives in, not the workspace's own", () => {
    expect(otherRepository('unityGUI@codice@cloud', 'codice@codice@cloud')).toBe('unityGUI@codice@cloud');
    expect(otherRepository('codice@codice@cloud', 'codice@codice@cloud')).toBeUndefined();
  });

  it("tells nothing for a private item or while the workspace's repository is unknown", () => {
    expect(otherRepository('', 'codice@codice@cloud')).toBeUndefined();
    expect(otherRepository('unityGUI@codice@cloud', undefined)).toBeUndefined();
  });
});
