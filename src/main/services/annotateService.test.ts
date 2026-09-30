import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ANNOTATE_DATE_FORMAT, ANNOTATE_FORMAT } from '../cm/annotation';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createAnnotateService } from './annotateService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function annotate(output: string) {
  const fake = fakeCmClient({ annotate: output });
  return { ...fake, service: createAnnotateService(serviceContext(fake.cm)) };
}

const TWO_LINES = formatOutput(
  ['1', '12', 'ana', '2026-09-25T10:00:00+02:00', 'br:/main', 'False', 'First', 'using System;'],
  ['2', '12', 'ana', '2026-09-25T10:00:00+02:00', 'br:/main', 'False', 'First', 'class Player {}'],
);

describe('annotate', () => {
  it("annotates the workspace's file with one quick command, each changeset's details once", async () => {
    const { service, commands } = annotate(TWO_LINES);

    const annotation = await service.file(WORKSPACE, 'src/player.cs');

    expect(commands).toMatchObject([
      { via: 'query', args: ['annotate', join(WORKSPACE, 'src', 'player.cs'), `--format=${ANNOTATE_FORMAT}`, `--dateformat=${ANNOTATE_DATE_FORMAT}`], options: { cwd: WORKSPACE } },
    ]);
    expect(annotation.lines.map((line) => [line.lineNumber, line.content, line.changesetId])).toEqual([
      [1, 'using System;', 12],
      [2, 'class Player {}', 12],
    ]);
    expect(annotation.changesets).toEqual([{ changesetId: 12, owner: 'ana', date: '2026-09-25T10:00:00+02:00', branch: '/main', comment: 'First', isMerge: false }]);
  });

  it('annotates a revision by its spec instead of the workspace file', async () => {
    const { service, commands } = annotate(TWO_LINES);

    await service.file(WORKSPACE, 'src/player.cs', 'revid:432@game@local');

    expect(commands[0]?.args[1]).toBe('revid:432@game@local');
  });
});
