import type { LocksApi } from '@shared/api/locks';
import { cmPlace } from '../cm/cmPlace';
import { LOCK_LIST_FORMAT_ARGS, lockReader } from '../cm/lockRecords';
import type { ServiceContext } from './ServiceContext';

export function createLocksService({ cm }: ServiceContext): LocksApi {
  return {
    // Every lock command names its repository: in a workspace or outside every one, it reads the same.
    list(place, repository, { onlyMine, onlyThisWorkspace = false }) {
      const server = repository.slice(repository.indexOf('@') + 1);
      return cm.queryRecords(
        [
          'lock',
          'list',
          '--anystatus',
          `--repository=${repository}`,
          ...(onlyMine ? ['--onlycurrentuser'] : []),
          ...(onlyThisWorkspace ? ['--onlycurrentworkspace'] : []),
          ...LOCK_LIST_FORMAT_ARGS,
        ],
        lockReader(server),
        cmPlace(place).options,
      );
    },

    async unlock(workspacePath, locks, { remove }) {
      const itemSpecs = locks.map((lock) => `itemid:${lock.itemId}@${lock.repository}`);
      await cm.query(['lock', 'unlock', ...itemSpecs, ...(remove ? ['--remove'] : [])], { cwd: workspacePath });
    },
  };
}
