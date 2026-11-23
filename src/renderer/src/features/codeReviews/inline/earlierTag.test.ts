import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { earlierTagOf, modelEarlierTagOf } from './earlierTag';
import type { LineThread, ModelThread } from './fileThreads';

function thread(fields: Partial<ReviewComment> = {}): LineThread {
  const anchor = { kind: 'line', revisionId: 20, itemId: 7, path: '/a.cs', firstLine: 3, lastLine: 3 } as const;
  return threadsOf([{ id: 1, guid: 'g', author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor, ...fields }])[0] as LineThread;
}

describe('earlierTagOf', () => {
  it('tells a thread still at its line from an outdated one', () => {
    expect(earlierTagOf(thread(), false)).toEqual({ label: 'Earlier version', tip: "Written on an earlier version of this file: this line hasn't changed since" });
    expect(earlierTagOf(thread(), true)).toEqual({ label: 'Outdated', tip: 'Written on an earlier version of this file: its line changed since' });
  });

  it('speaks of the lines of a thread on a range', () => {
    const range = thread({ anchor: { kind: 'line', revisionId: 20, itemId: 7, path: '/a.cs', firstLine: 3, lastLine: 5 } });
    expect(earlierTagOf(range, false).tip).toBe("Written on an earlier version of this file: these lines haven't changed since");
    expect(earlierTagOf(range, true).tip).toBe('Written on an earlier version of this file: its lines changed since');
  });

  it('names the changeset a thread was written in, in its own diff', () => {
    expect(earlierTagOf(thread({ changesetId: 8 }), true).tip).toBe('Written on the file as changeset 8 left it: its line changed since');
  });
});

describe('modelEarlierTagOf', () => {
  const onModel = (fields: Partial<ReviewComment> = {}): ModelThread => {
    const anchor = { kind: 'model' as const, revisionId: 20, itemId: 7, path: '/Car.fbx', spot: { point: { x: 0, y: 0, z: 0 }, node: { path: ['Car', 'Wheel'] } } };
    return threadsOf([{ id: 1, guid: 'g', author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor, ...fields }])[0] as ModelThread;
  };

  it('says it shows on its part as it is now, or that its part is gone, naming the part', () => {
    expect(modelEarlierTagOf(onModel(), false)).toEqual({ label: 'Earlier version', tip: 'Written on an earlier version of this model: shown on Wheel as it is now' });
    expect(modelEarlierTagOf(onModel(), true).tip).toBe("Written on an earlier version of this model: Wheel isn't in this version");
  });

  it('names the changeset a thread was written in, in its own diff', () => {
    expect(modelEarlierTagOf(onModel({ changesetId: 8 }), true).tip).toBe("Written on the model as changeset 8 left it: Wheel isn't in this version");
  });

  it('says "its part" when the location names none, names it with nothing, or by an exporter's name', () => {
    const unnamed = (path?: string[]): ModelThread => {
      const anchor = { kind: 'model' as const, revisionId: 20, itemId: 7, path: '/Car.fbx', spot: { point: { x: 0, y: 0, z: 0 }, ...(path ? { node: { path } } : {}) } };
      return threadsOf([{ id: 1, guid: 'g', author: 'ana', date: '2026-11-06T10:00:00Z', text: '', kind: 'question', anchor }])[0] as ModelThread;
    };
    expect(modelEarlierTagOf(unnamed(), true).tip).toBe("Written on an earlier version of this model: its part isn't in this version");
    expect(modelEarlierTagOf(unnamed(['Car', '']), false).tip).toBe('Written on an earlier version of this model: shown on its part as it is now');
    expect(modelEarlierTagOf(unnamed(['Car', 'mesh_0']), true).tip).toBe("Written on an earlier version of this model: its part isn't in this version");
  });
});
