import { describe, expect, it } from 'vitest';
import { parseShelveApplyPreview } from './shelveApplyPreview';

describe('parseShelveApplyPreview', () => {
  it('lists the paths a shelve changes or adds', () => {
    const preview = parseShelveApplyPreview(
      [
        'The file /src/a.ts#sh:3 was modified on source and will replace the destination version',
        'The item /src/new.ts#sh:3 has been added on source and will be added as result of the merge',
      ].join('\n'),
    );
    expect(preview).toEqual({ changedPaths: ['/src/a.ts', '/src/new.ts'], conflictedPaths: [] });
  });

  it('reports the paths that need a merge as conflicts', () => {
    const preview = parseShelveApplyPreview(
      'The file /src/my file.ts needs to be merged from sh:2 to cs:4 base cs:1. Changed by both contributors.\n',
    );
    expect(preview).toEqual({ changedPaths: ['/src/my file.ts'], conflictedPaths: ['/src/my file.ts'] });
  });
});
