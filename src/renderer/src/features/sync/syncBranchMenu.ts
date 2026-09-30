import type { MenuEntry } from '../../lib/actions';
import { groupedMenu } from '../../lib/menuGroups';
import { menuAction } from '../../components/menuWords';

interface BranchSync {
  push: (branch: string) => void;
  pull: (branch: string) => void;
}

/** A branch's menu in Sync: push it to the other repository, or pull that one's version; one branch at a time. */
export function syncBranchMenu(branches: readonly { name: string }[], remote: string | null, sync: BranchSync): MenuEntry[] {
  const branch = branches.length === 1 ? branches[0]! : null;
  if (!branch || !remote) return [];
  return groupedMenu([
    menuAction('push', () => sync.push(branch.name), { label: `Push to ${remote}` }),
    menuAction('pull', () => sync.pull(branch.name), { label: `Pull from ${remote}` }),
  ]);
}
