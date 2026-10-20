import { describe, expect, it } from 'vitest';
import type { Annotation } from '@shared/domain/annotate';
import { annotationBodyOf } from './annotationBody';

const annotated: Annotation = {
  lines: [
    { lineNumber: 1, content: 'using UnityEngine;', changesetId: 4 },
    { lineNumber: 2, content: '', changesetId: 4 },
  ],
  changesets: [{ changesetId: 4, owner: 'ana@example.com', date: '2026-03-01T00:00:00Z', branch: '/main', comment: 'Start', isMerge: false }],
};

describe('annotationBodyOf', () => {
  it('annotates until the annotation is read, then shows the code', () => {
    expect(annotationBodyOf(undefined, false)).toBe('annotating');
    expect(annotationBodyOf(annotated, false)).toBe('code');
  });

  it('says an empty file is empty instead of showing an empty box', () => {
    expect(annotationBodyOf({ lines: [], changesets: [] }, false)).toBe('emptyFile');
  });

  it("says it couldn't annotate when reading failed", () => {
    expect(annotationBodyOf(undefined, true)).toBe('failed');
  });
});
