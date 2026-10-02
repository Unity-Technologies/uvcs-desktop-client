import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dialog, shell } from 'electron';
import { fakeCmClient, optionValue, type CmAnswer } from '../cm/testing/fakeCmClient';
import { revisionFiles } from './revisionFiles';

vi.mock('electron', () => ({ dialog: { showSaveDialog: vi.fn() }, shell: { openPath: vi.fn() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const openInEditor = vi.fn(async (_path: string, _editorId: string) => {});
const REVISION = { revisionId: 45, repository: 'game@local' };

/** `cm cat` writing the old version to the file it is given. */
const CAT: CmAnswer = async ({ args }) => {
  await writeFile(optionValue(args, '--file=')!, 'old version');
  return '';
};

describe('revision files', () => {
  beforeEach(() => {
    vi.mocked(shell.openPath).mockReset().mockResolvedValue('');
    openInEditor.mockReset();
  });

  it('saves the revision where the user chose, with one cm cat', async () => {
    const target = join(await mkdtemp(join(tmpdir(), 'save-')), 'a.cs');
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: false, filePath: target });
    const fake = fakeCmClient({ cat: CAT });

    expect(await revisionFiles(fake.cm, openInEditor).saveAs(WORKSPACE, REVISION, 'a.cs')).toBe(target);
    expect(fake.lines()).toEqual([`cat revid:45@game@local --file=${target}`]);
    expect(await readFile(target, 'utf8')).toBe('old version');
  });

  it('saves nothing when the user cancels', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' });
    const fake = fakeCmClient();

    expect(await revisionFiles(fake.cm, openInEditor).saveAs(WORKSPACE, REVISION, 'a.cs')).toBeNull();
    expect(fake.commands).toEqual([]);
  });

  it('opens the revision under its own name, in a folder of its own each time', async () => {
    const fake = fakeCmClient({ cat: CAT });
    const files = revisionFiles(fake.cm, openInEditor);

    await files.open(WORKSPACE, REVISION, 'a.cs');
    await files.open(WORKSPACE, REVISION, 'a.cs');

    const [first, second] = vi.mocked(shell.openPath).mock.calls.map(([path]) => path);
    expect([basename(first!), basename(second!)]).toEqual(['a.cs', 'a.cs']);
    expect(dirname(first!)).not.toBe(dirname(second!));
    expect(await readFile(first!, 'utf8')).toBe('old version');
  });

  it('opens the revision in the editor the user picked, instead of the default app', async () => {
    const fake = fakeCmClient({ cat: CAT });

    await revisionFiles(fake.cm, openInEditor).open(WORKSPACE, REVISION, 'a.cs', 'vscode');

    const [[path, editorId]] = openInEditor.mock.calls as [[string, string]];
    expect([basename(path), editorId]).toEqual(['a.cs', 'vscode']);
    expect(await readFile(path, 'utf8')).toBe('old version');
    expect(shell.openPath).not.toHaveBeenCalled();
  });

  it("fails with the OS's reason when no app opens it", async () => {
    vi.mocked(shell.openPath).mockResolvedValueOnce('No application knows how to open this file.');
    const fake = fakeCmClient({ cat: CAT });

    await expect(revisionFiles(fake.cm, openInEditor).open(WORKSPACE, REVISION, 'a.cs')).rejects.toThrow('No application knows how to open this file.');
  });
});
