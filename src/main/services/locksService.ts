import type { LocksApi } from '@shared/api/locks';
import { LOCK_LIST_FORMAT_ARGS, parseLocks } from '../cm/lockRecords';
import type { ServiceContext } from './ServiceContext';

export function createLocksService({ cm }: ServiceContext): LocksApi {
  return {
    async list(workspacePath, repository, { onlyMine, onlyThisWorkspace = false }) {
      const output = await cm.query(
        [
          'lock',
          'list',
          '--anystatus',
          `--repository=${repository}`,
          ...(onlyMine ? ['--onlycurrentuser'] : []),
          ...(onlyThisWorkspace ? ['--onlycurrentworkspace'] : []),
          ...LOCK_LIST_FORMAT_ARGS,
        ],
        { cwd: workspacePath },
      );
      return parseLocks(output, repository.slice(repository.indexOf('@') + 1));
    },

    async unlock(workspacePath, locks, { remove }) {
      const itemSpecs = locks.map((lock) => `itemid:${lock.itemId}@${lock.repository}`);
      await cm.query(['lock', 'unlock', ...itemSpecs, ...(remove ? ['--remove'] : [])], { cwd: workspacePath });
    },
  };
}
