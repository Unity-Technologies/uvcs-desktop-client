import { describe, expect, it } from 'vitest';
import type { WorkspaceNames } from './WorkspaceHeaders';
import { kindDependencies, kindFromHeaders } from './shelveFlowDependencies';

const headersNaming = (names: WorkspaceNames) => ({ names: async () => names });

describe('kindFromHeaders', () => {
  it('tells a partial workspace from the headers', async () => {
    await expect(kindFromHeaders(headersNaming({ name: 'wk', guid: 'g', kind: 'partial' }))('wk')).resolves.toBe('partial');
  });

  it("runs the standard commands when cm didn't tell the kind", async () => {
    await expect(kindFromHeaders(headersNaming({ name: '', guid: '' }))('wk')).resolves.toBe('standard');
  });
});

describe('kindDependencies', () => {
  it("forgetting the kind forgets the workspace's headers, so the next read asks again", () => {
    const forgotten: string[] = [];
    const { forgetKind } = kindDependencies({ ...headersNaming({ name: 'wk', guid: 'g' }), forget: (path) => forgotten.push(path) });

    forgetKind('wk');

    expect(forgotten).toEqual(['wk']);
  });
});
