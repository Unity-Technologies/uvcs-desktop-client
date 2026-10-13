import { describe, expect, it } from 'vitest';
import type { ModelBytes } from '@shared/domain/content';
import { DEFAULT_IMPORT_SETTINGS } from './modelImportSettings';
import { compareModels, readModel } from './modelWorkerSession';

// Node has no Worker: these run the session's main-thread way, which is what it falls back to when the worker can't start.
const obj = (text: string): ModelBytes => ({ bytes: new TextEncoder().encode(text), format: 'obj' });
const TRIANGLE = 'o Leaf\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';

describe('readModel', () => {
  it('reads the same bytes with the same options once', async () => {
    const model = obj(TRIANGLE);
    const options = { companions: {}, settingsFrom: 'meta' as const, settings: DEFAULT_IMPORT_SETTINGS };
    expect(readModel(model, options)).toBe(readModel(model, { companions: {}, settingsFrom: 'meta' as const, settings: { ...DEFAULT_IMPORT_SETTINGS } }));
    expect((await readModel(model, options)).kind).toBe('read');
  });

  it('reads again under other import settings, which scale the model', async () => {
    const model = obj(TRIANGLE);
    const plain = await readModel(model, { companions: {}, settingsFrom: 'meta' as const, settings: DEFAULT_IMPORT_SETTINGS });
    const scaled = await readModel(model, { companions: {}, settingsFrom: 'meta' as const, settings: { ...DEFAULT_IMPORT_SETTINGS, scaleFactor: 100 } });
    expect(plain.kind === 'read' && scaled.kind === 'read' && [plain.summary.importScale, scaled.summary.importScale]).toEqual([1, 100]);
  });

  it('settles on a failure for bytes that are no model, never waiting for good', async () => {
    expect(await readModel({ bytes: new Uint8Array([1, 2, 3]), format: 'fbx' })).toEqual({ kind: 'failed', failure: { kind: 'unreadable' } });
  });
});

describe('compareModels', () => {
  it('compares a pair once', async () => {
    const before = await readModel(obj(TRIANGLE));
    const after = await readModel(obj(TRIANGLE.replace('v 1 0 0', 'v 2 0 0')));
    if (before.kind !== 'read' || after.kind !== 'read') throw new Error('Not read');
    const comparison = compareModels(before.model, after.model);
    expect(compareModels(before.model, after.model)).toBe(comparison);
    expect((await comparison)?.after).toHaveLength(1);
  });
});
