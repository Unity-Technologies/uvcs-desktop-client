import { describe, expect, it } from 'vitest';
import type { WorkspaceNames } from './WorkspaceHeaders';
import { kindFromHeaders } from './shelveFlowDependencies';

const headersNaming = (names: WorkspaceNames) => ({ names: async () => names });

describe('kindFromHeaders', () => {
  it('tells a partial workspace from the headers', async () => {
    await expect(kindFromHeaders(headersNaming({ name: 'wk', guid: 'g', kind: 'partial' }))('wk')).resolves.toBe('partial');
  });

  it("runs the standard commands when cm didn't tell the kind", async () => {
    await expect(kindFromHeaders(headersNaming({ name: '', guid: '' }))('wk')).resolves.toBe('standard');
  });
});
