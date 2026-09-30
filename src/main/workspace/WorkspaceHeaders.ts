import type { CmClient } from '../cm/CmClient';
import { parseRecords, recordFormat } from '../cm/formatRecords';
import { readWorkspaceStatus, type WorkspaceStatus } from '../cm/workspaceStatus';

/** A read this recent answers again, unless something rewrote the workspace meanwhile (`forget`). */
const FRESH_MS = 5000;

export interface WorkspaceNames {
  name: string;
  guid: string;
}

export interface HeaderReaders {
  status(workspacePath: string): Promise<WorkspaceStatus>;
  names(workspacePath: string): Promise<WorkspaceNames>;
}

export function cmHeaderReaders(cm: CmClient): HeaderReaders {
  return {
    status: (workspacePath) => readWorkspaceStatus(cm, workspacePath),
    names: async (workspacePath) => {
      const output = await cm.query(['getworkspacefrompath', workspacePath, `--format=${recordFormat(['wkname', 'guid'])}`], { cwd: workspacePath });
      const [name = '', guid = ''] = parseRecords(output)[0] ?? [];
      return { name: name.trim(), guid: guid.trim() };
    },
  };
}

interface Reads {
  at: number;
  status?: Promise<WorkspaceStatus>;
  names?: Promise<WorkspaceNames>;
}

/**
 * What a workspace is loaded from (`cm status --header`) and its name and guid, shared by the reads that follow one
 * another as a window opens it (the workspace info, then the left changes). Every command that rewrites a workspace,
 * and every `.plastic` rewrite the watchers see, forgets them.
 */
export class WorkspaceHeaders {
  private readonly reads = new Map<string, Reads>();

  constructor(
    private readonly readers: HeaderReaders,
    private readonly now: () => number = Date.now,
  ) {}

  status(workspacePath: string): Promise<WorkspaceStatus> {
    return this.shared(workspacePath, 'status');
  }

  names(workspacePath: string): Promise<WorkspaceNames> {
    return this.shared(workspacePath, 'names');
  }

  /** The workspace changed (every workspace, without a path): the next reads ask `cm` again. */
  forget(workspacePath?: string): void {
    if (workspacePath === undefined) this.reads.clear();
    else this.reads.delete(workspacePath);
  }

  /** The read of `kind` this workspace shares while fresh, started now if there is none. */
  private shared<Kind extends 'status' | 'names'>(workspacePath: string, kind: Kind): NonNullable<Reads[Kind]> {
    const reads = this.freshReads(workspacePath);
    const shared = reads[kind];
    if (shared) return shared;

    const read = (kind === 'status' ? this.readers.status(workspacePath) : this.readers.names(workspacePath)) as NonNullable<Reads[Kind]>;
    reads[kind] = read;
    read.catch(() => {
      // A failure is not an answer to share.
      if (reads[kind] === read) delete reads[kind];
    });
    return read;
  }

  /** The workspace's reads still fresh, once every workspace's older ones are dropped. */
  private freshReads(workspacePath: string): Reads {
    const now = this.now();
    for (const [path, reads] of this.reads) if (now - reads.at >= FRESH_MS) this.reads.delete(path);
    let reads = this.reads.get(workspacePath);
    if (!reads) {
      reads = { at: now };
      this.reads.set(workspacePath, reads);
    }
    return reads;
  }
}
