import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { MAIN_BRANCH_GUID } from '@shared/domain/branch';
import { readRecentBranches, withRecentBranch } from './recentBranchesConf';

/**
 * The recent branches the official Desktop client shows in its branch popup, shared with it through its
 * `plasticgui.conf`. It reads the file once at start and rewrites it whole when it saves, so while it runs it neither
 * sees what this app writes nor keeps it.
 */
export function loadRecentBranches(workspaceGuid: string): Promise<string[]> {
  return readConf().then((conf) => readRecentBranches(conf, workspaceGuid));
}

/** Like the official client on every switch to a branch but /main. Writes one at a time: every window shares the file. */
export function saveRecentBranch(workspaceGuid: string, branchGuid: string): Promise<void> {
  if (branchGuid.toLowerCase() === MAIN_BRANCH_GUID) return Promise.resolve();
  const saved = pendingSave.then(async () => {
    const file = confFile();
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, withRecentBranch(await readConf(), workspaceGuid, branchGuid));
    await rename(temp, file);
  });
  pendingSave = saved.catch(() => undefined);
  return saved;
}

let pendingSave: Promise<void> = Promise.resolve();

async function readConf(): Promise<string> {
  try {
    return await readFile(confFile(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw error;
  }
}

/** Where the official client keeps its settings (`UserConfigFolder`): `PLASTIC_HOME`, else the user's `plastic4` folder. */
function confFile(): string {
  const folder =
    process.env.PLASTIC_HOME ||
    (process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'plastic4') : join(homedir(), '.plastic4'));
  return join(folder, 'plasticgui.conf');
}
