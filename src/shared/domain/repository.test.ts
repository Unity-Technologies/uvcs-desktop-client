import { describe, expect, it } from 'vitest';
import { otherRepository } from './repository';

describe('otherRepository', () => {
  it("names the xlinked repository an item lives in, not the workspace's own", () => {
    expect(otherRepository('editorGUI@acme@cloud', 'acme@acme@cloud')).toBe('editorGUI@acme@cloud');
    expect(otherRepository('acme@acme@cloud', 'acme@acme@cloud')).toBeUndefined();
  });

  it("tells nothing for a private item or while the workspace's repository is unknown", () => {
    expect(otherRepository('', 'acme@acme@cloud')).toBeUndefined();
    expect(otherRepository('editorGUI@acme@cloud', undefined)).toBeUndefined();
  });
});
