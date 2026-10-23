import type { LocksApi } from '@shared/api/locks';
import { cmPlace } from '../cm/cmPlace';
import { LOCK_LIST_FORMAT_ARGS, parseLocks } from '../cm/lockRecords';
import type { ServiceContext } from './ServiceContext';

export function createLocksService({ cm }: ServiceContext): LocksApi {
  return {
    // Every lock command names its repository: in a workspace or outside every one, it reads the same.
    async list(place, repository, { onlyMine, onlyThisWorkspace = false }) {
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
        cmPlace(place).options,
      );
      const server = repository.slice(repository.indexOf('@') + 1);
      return parseLocks(output, server);
    },

    async unlock(workspacePath, locks, { remove }) {
      const itemSpecs = locks.map((lock) => `itemid:${lock.itemId}@${lock.repository}`);
      await cm.query(['lock', 'unlock', ...itemSpecs, ...(remove ? ['--remove'] : [])], { cwd: workspacePath });
    },
  };
}
