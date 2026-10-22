import { fakeApi } from '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { MergeTool, MergeToolOutcome, SmartMergeOutcome, SmartMergeRequest } from '@shared/domain/mergeTools';
import { WORKSPACE_ROLES, type MergeLabels } from '../mergeDescription';
import type { FileConflictState } from '../resolve/useFileConflicts';
import { stopMergeToolSession } from './mergeToolSessions';
import type { Merger } from './mergeToolFor';
import { resolveInMergeTool, type OpenTool } from './resolveInMergeTool';
import { shownToasts } from '../../../testing/operationOutcome';
import { useToastStore } from '../../../ui/toast/toastStore';

const vsCode: MergeTool = { id: 'vscode', name: 'VS Code', origin: 'known', executable: 'code', args: [], defaultArgs: [], canBringToFront: true };
const unityYamlMerge: Merger = { kind: 'unityYamlMerge', merge: { id: 'unityyamlmerge:2022.3.10f1', executable: 'u', editorVersion: '2022.3.10f1' }, fallback: vsCode };
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
 * Resolves the file, main answering UnityYAMLMerge with `smartMerged` and the tool with `saved`; what showed as open.
 * `decidedMeanwhile`: the user decides the file in the app while UnityYAMLMerge runs. `merger`: UnityYAMLMerge falling
 * back to VS Code by default; `quiet` false shows its toasts.
 */
async function resolve(
  state: FileConflictState,
  smartMerged: SmartMergeOutcome,
  {
    saved = { kind: 'resolved', text: 'by hand\n' },
    decidedMeanwhile = false,
    merger = unityYamlMerge,
    quiet = true,
  }: { saved?: MergeToolOutcome; decidedMeanwhile?: boolean; merger?: Merger; quiet?: boolean } = {},
) {
  let decided = false;
  fakeApi.answer('mergeTools.smartMerge', async () => {
    decided = decidedMeanwhile;
    return smartMerged;
  });
  fakeApi.answer('mergeTools.resolve', async () => saved);
  const shown: (string | null)[] = [];
  const onOpen = (open: OpenTool | null) => shown.push(open && `${open.toolName}${open.canBringToFront ? ' (front)' : ''}`);
  const session = await resolveInMergeTool('/wk', state, merger, labels, onOpen, { quiet, stillUndecided: () => !decided });
  return { session, shown, methods: fakeApi.methods() };
}

describe('resolveInMergeTool', () => {
  it('takes UnityYAMLMerge’s merge of a Unity asset, showing UnityYAMLMerge at work and opening no tool', async () => {
    const { session, shown, methods } = await resolve(prefab(), { kind: 'merged', text: 'merged\n' });

    expect(session.decision).toEqual({ kind: 'text', text: 'merged\n', tool: 'UnityYAMLMerge' });
    expect(shown).toEqual(['UnityYAMLMerge', null]);
    expect(methods).toEqual(['mergeTools.smartMerge']);
    const [[request]] = fakeApi.argsOf('mergeTools.smartMerge') as [[SmartMergeRequest]];
    expect(request).toMatchObject({ toolId: 'unityyamlmerge:2022.3.10f1', path: 'Assets/Player.prefab', base: `${UNITY}base\n`, yours: `${UNITY}yours\n`, incoming: `${UNITY}incoming\n` });
  });

  it('opens the tool, then, when UnityYAMLMerge doesn’t merge the file', async () => {
    const { session, shown, methods } = await resolve(prefab(), { kind: 'notMerged' });

    expect(session.decision).toEqual({ kind: 'text', text: 'by hand\n', tool: 'VS Code' });
    expect(shown).toEqual(['UnityYAMLMerge', null, 'VS Code (front)', null]);
    expect(methods).toEqual(['mergeTools.smartMerge', 'mergeTools.resolve']);
  });

  it.each([{ kind: 'merged', text: 'merged\n' }, { kind: 'notMerged' }] as const)(
    'keeps what the user decided in the app while UnityYAMLMerge ran, and opens nothing (UnityYAMLMerge: $kind)',
    async (smartMerged) => {
      const { session, methods } = await resolve(prefab(), smartMerged, { decidedMeanwhile: true });

      expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
      expect(methods).toEqual(['mergeTools.smartMerge']);
    },
  );

  it('runs UnityYAMLMerge on a .meta file, with no Unity header, opening the fallback when it can’t merge it', async () => {
    const META = 'fileFormatVersion: 2\nguid: 1\n';
    const meta = prefab({
      file: { key: '/Assets/Player.prefab.meta', path: 'Assets/Player.prefab.meta', base: { kind: 'empty' }, source: { kind: 'empty' }, destination: { kind: 'empty' } },
      contents: { base: text(META), source: text(META), destination: text(META) },
    });
    const { shown, methods } = await resolve(meta, { kind: 'notMerged' });

    expect(methods).toEqual(['mergeTools.smartMerge', 'mergeTools.resolve']);
    expect(shown).toEqual(['UnityYAMLMerge', null, 'VS Code (front)', null]);
  });

  it('says when the fallback opens on what UnityYAMLMerge couldn’t merge', async () => {
    useToastStore.setState({ toasts: [] });
    await resolve(prefab(), { kind: 'notMerged' }, { quiet: false });

    expect(shownToasts().map(({ title, detail }) => [title, detail])).toEqual([
      ["UnityYAMLMerge couldn't merge Player.prefab", 'Opening it in VS Code'],
      ['Resolved Player.prefab in VS Code', undefined],
    ]);
  });

  it('fails, opening nothing, when UnityYAMLMerge can’t merge and no tool was found', async () => {
    const { session, methods } = await resolve(prefab(), { kind: 'notMerged' }, { merger: { ...unityYamlMerge, fallback: undefined } as Merger });

    expect(session.outcome.kind).toBe('failed');
    expect(methods).toEqual(['mergeTools.smartMerge']);
  });

  it('opens a tool straight away, never running UnityYAMLMerge, when the file’s rule is a tool, Unity asset or not', async () => {
    const { shown, methods } = await resolve(prefab(), { kind: 'merged', text: 'never\n' }, { merger: { kind: 'tool', tool: vsCode } });

    expect(shown).toEqual(['VS Code (front)', null]);
    expect(methods).toEqual(['mergeTools.resolve']);
  });

  it('opens nothing when the user stops UnityYAMLMerge just as it ends on its own, too late for main to stop it', async () => {
    fakeApi.answer('mergeTools.stopWaiting', async () => undefined);
    fakeApi.answer('mergeTools.smartMerge', async ({ sessionId }: SmartMergeRequest) => {
      // Skip, Stop or leaving the page, while main already has UnityYAMLMerge's answer: it finds nothing to stop.
      void stopMergeToolSession(sessionId);
      return { kind: 'notMerged' };
    });
    fakeApi.answer('mergeTools.resolve', async () => ({ kind: 'resolved', text: 'never\n' }));

    const session = await resolveInMergeTool('/wk', prefab(), unityYamlMerge, labels, () => undefined, { quiet: true, stillUndecided: () => true });

    expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
    expect(fakeApi.methods()).toEqual(['mergeTools.smartMerge', 'mergeTools.stopWaiting']);
  });

  it('opens nothing more when the user stops UnityYAMLMerge', async () => {
    const { session, methods } = await resolve(prefab(), { kind: 'stopped' });

    expect(session).toEqual({ outcome: { kind: 'unchanged', exitCode: null, errorOutput: '' }, decision: undefined });
    expect(methods).toEqual(['mergeTools.smartMerge']);
  });

  it('opens the fallback straight away once the user decided something, UnityYAMLMerge’s merge included, saying nothing of it', async () => {
    const decided = prefab({ decision: { kind: 'text', text: 'merged\n', tool: 'UnityYAMLMerge' }, decidedByUser: true, resolution: { choice: 'text', text: 'merged\n' } });

    const { methods } = await resolve(decided, { kind: 'merged', text: 'never\n' });

    expect(methods).toEqual(['mergeTools.resolve']);
    expect(fakeApi.argsOf('mergeTools.resolve')[0]![1]).toMatchObject({ startText: 'merged\n' });
  });
});
