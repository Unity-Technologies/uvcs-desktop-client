import { describe, expect, it } from 'vitest';
import { selectorName } from './workspaceStatus';

describe('selectorName', () => {
  it('removes the repository spec even when the name repeats in the server', () => {
    expect(selectorName('/main/scm1008833@codice@codice@cloud', 'codice', 'codice@cloud')).toBe('/main/scm1008833');
  });

  it('removes a local repository spec', () => {
    expect(selectorName('/main@sandbox@local', 'sandbox', 'local')).toBe('/main');
  });

  it('keeps names without a repository suffix', () => {
    expect(selectorName('/main', 'sandbox', 'local')).toBe('/main');
  });
});
