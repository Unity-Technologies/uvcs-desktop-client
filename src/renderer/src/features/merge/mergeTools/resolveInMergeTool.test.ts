import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolOutcome, SmartMergeOutcome, SmartMergeRequest } from '@shared/domain/mergeTools';
import { WORKSPACE_ROLES, type MergeLabels } from '../mergeDescription';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { stopMergeToolSession } from './mergeToolSessions';
import { resolveInMergeTool, type OpenTool } from './resolveInMergeTool';

const vsCode: MergeTool = { id: 'vscode', name: 'VS Code', origin: 'known', executable: 'code', args: [], defaultArgs: [], canBringToFront: true };
const labels: MergeLabels = { source: '/main', destination: '/main/task', roles: WORKSPACE_ROLES };
const UNITY = '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n';
const text = (value: string) => ({ text: value, isBinary: false, size: value.length });

/** A prefab nobody decided anything for: it holds the automatic merge, with its markers, as its decision. */
const prefab = (changes: Partial<FileConflictState> = {}): FileConflictState => ({
  file: { key: '/Assets/Player.prefab', path: 'Assets/Player.prefab', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
  status: 'ready',
  isBinary: false,
  decidedByUser: false,
  decision: { kind: 'text', text: '<<<<<<< Yours\n' },
  contents: { base: text(`${UNITY}base\n`), source: text(`${UNITY}incoming\n`), destination: text(`${UNITY}yours\n`) },
  resolution: null,
  mergedAutomatically: false,
  remainingConflicts: 1,
  ...changes,
});

/**
 * Resolves the file, main answering Smart Merge with `smartMerged` and the tool with `saved`; what showed as open.
 * `decidedMeanwhile`: the user decides the file in the app while Smart Merge runs. `withUnity`: Smart Merge was found.
 */
async function resolve(
  state: FileConflictState,
  smartMerged: SmartMergeOutcome,
  { saved = { kind: 'resolved', text: 'by hand\n' }, decidedMeanwhile = false, withUnity = true }: { saved?: MergeToolOutcome; decidedMeanwhile?: boolean; withUnity?: boolean } = {},
) {
  let decided = false;
  fakeApi.answer('mergeTools.smartMerge', async () => {
    decided = decidedMeanwhile;
    return smartMerged;
  });
  fakeApi.answer('mergeTools.resolve', async () => saved);
  const shown: (string | null)[] = [];
  const onOpen = (open: OpenTool | null) => shown.push(open && `${open.toolName}${open.canBringToFront ? ' (front)' : ''}`);
  const session = await resolveInMergeTool('/wk', state, vsCode, labels, onOpen, { quiet: true, smartMerge: withUnity, stillUndecided: () => !decided });
  return { session, shown, methods: fakeApi.methods() };
}

describe('resolveInMergeTool', () => {
  it('takes Smart Merge’s merge of a Unity asset, showing Smart Merge at work and opening no tool', async () => {
    const { session, shown, methods } = await resolve(prefab(), { kind: 'merged', text: 'merged\n' });

    expect(session.decision).toEqual({ kind: 'text', text: 'merged\n', tool: 'Smart Merge' });
    expect(shown).toEqual(['Smart Merge', null]);
    expect(methods).toEqual(['mergeTools.smartMerge']);
    const [[request]] = fakeApi.argsOf('mergeTools.smartMerge') as [[SmartMergeRequest]];
    expect(request).toMatchObject({ path: 'Assets/Player.prefab', base: `${UNITY}base\n`, yours: `${UNITY}yours\n`, incoming: `${UNITY}incoming\n` });
  });

  it('opens the tool, then, when Smart Merge doesn’t merge the file', async () => {
    const { session, shown, methods } = await resolve(prefab(), { kind: 'notMerged' });

    expect(session.decision).toEqual({ kind: 'text', text: 'by hand\n', tool: 'VS Code' });
    expect(shown).toEqual(['Smart Merge', null, 'VS Code (front)', null]);
    expect(methods).toEqual(['mergeTools.smartMerge', 'mergeTools.resolve']);
  });

  it.each([{ kind: 'merged', text: 'merged\n' }, { kind: 'notMerged' }] as const)(
    'keeps what the user decided in the app while Smart Merge ran, and opens nothing (Smart Merge: $kind)',
    async (smartMerged) => {
      const { session, methods } = await resolve(prefab(), smartMerged, { decidedMeanwhile: true });

      expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
      expect(methods).toEqual(['mergeTools.smartMerge']);
    },
  );

  it('opens the tool straight away without a Unity Editor, never showing Smart Merge at work', async () => {
    const { shown, methods } = await resolve(prefab(), { kind: 'merged', text: 'never\n' }, { withUnity: false });

    expect(shown).toEqual(['VS Code (front)', null]);
    expect(methods).toEqual(['mergeTools.resolve']);
  });

  it('opens nothing when the user stops Smart Merge just as it ends on its own, too late for main to stop it', async () => {
    fakeApi.answer('mergeTools.stopWaiting', async () => undefined);
    fakeApi.answer('mergeTools.smartMerge', async ({ sessionId }: SmartMergeRequest) => {
      // Skip, Stop or leaving the page, while main already has Smart Merge's answer: it finds nothing to stop.
      void stopMergeToolSession(sessionId);
      return { kind: 'notMerged' };
    });
    fakeApi.answer('mergeTools.resolve', async () => ({ kind: 'resolved', text: 'never\n' }));

    const session = await resolveInMergeTool('/wk', prefab(), vsCode, labels, () => undefined, { quiet: true, smartMerge: true, stillUndecided: () => true });

    expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
    expect(fakeApi.methods()).toEqual(['mergeTools.smartMerge', 'mergeTools.stopWaiting']);
  });

  it('opens nothing more when the user stops Smart Merge', async () => {
    const { session, methods } = await resolve(prefab(), { kind: 'stopped' });

    expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
    expect(methods).toEqual(['mergeTools.smartMerge']);
  });

  it('opens the tool straight away once the user decided something, Smart Merge’s merge included', async () => {
    const decided = prefab({ decision: { kind: 'text', text: 'merged\n', tool: 'Smart Merge' }, decidedByUser: true, resolution: { choice: 'text', text: 'merged\n' } });

    const { methods } = await resolve(decided, { kind: 'merged', text: 'never\n' });

    expect(methods).toEqual(['mergeTools.resolve']);
    expect(fakeApi.argsOf('mergeTools.resolve')[0]![1]).toMatchObject({ startText: 'merged\n' });
  });
});
