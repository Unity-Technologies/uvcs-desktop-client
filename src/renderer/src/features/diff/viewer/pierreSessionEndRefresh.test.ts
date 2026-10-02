import { DiffHunksRenderer } from '@pierre/diffs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { typedIntoPierre } from './pierreSessionFixture';
import { installPierreSessionEndRefresh } from './pierreSessionEndRefresh';

const ORIGINAL = 'namespace Codice;\nusing Codice.CM.Common;\nclass Main {}\n';
const MODIFIED = 'namespace Codice.Client;\nusing Codice.CM.Common;\nclass Main {}\n';

/** Counts how often Pierre highlights a whole diff. */
function countHighlights() {
  return vi.spyOn(DiffHunksRenderer.prototype as unknown as { renderDiffWithHighlighter: () => unknown }, 'renderDiffWithHighlighter');
}

/**
 * A diff typed into whose edit session just ended, as when its editor detaches: Pierre refreshes its colors. Counts the
 * highlights from then on.
 */
async function sessionJustEnded() {
  installPierreSessionEndRefresh();
  const session = await typedIntoPierre(ORIGINAL, MODIFIED, 'recognizeAll');
  session.type(0, 'namespace Codice.Server;');
  const renderer = (session.component as unknown as { hunksRenderer: DiffHunksRenderer }).hunksRenderer;
  const highlights = countHighlights();
  renderer.endEditSession();
  return { component: session.component, highlights, refreshed: renderer.refreshHighlightedResult() };
}

afterEach(() => vi.restoreAllMocks());

describe('installPierreSessionEndRefresh', () => {
  it('highlights nothing for a diff that goes away as its session ends', async () => {
    const { component, highlights, refreshed } = await sessionJustEnded();
    component.cleanUp();
    await refreshed;
    expect(highlights).not.toHaveBeenCalled();
  });

  it('still refreshes the colors of a diff that stays, once the app has moved on', async () => {
    const { highlights, refreshed } = await sessionJustEnded();
    expect(highlights).not.toHaveBeenCalled();
    await refreshed;
    expect(highlights).toHaveBeenCalledTimes(1);
  });
});
