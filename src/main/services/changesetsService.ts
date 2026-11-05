import type { ChangesetsApi } from '@shared/api/changesets';
import type { OneObjectRead } from '@shared/api/oneObjectRead';
import type { Changeset } from '@shared/domain/changeset';
import type { Place } from '@shared/domain/place';
import { cmPlace } from '../cm/cmPlace';
import { equalsCondition, findArgs, findQueryArgs } from '../cm/findQuery';
import { FOUND_BRANCH_STARTS, FOUND_CHANGESETS } from '../cm/foundObjects';
import { layoutReader } from '../cm/formatRecords';
import { readOneObject } from './oneObjectRead';
import type { ServiceContext } from './ServiceContext';

/**
 * `cm find changeset` leaves out the changesets of hidden branches unless asked for: a branch named in the filter
 * shows its changesets whether it is hidden or not, while the list of every branch keeps hidden ones out.
 */
const IGNORE_HIDDEN = "ignorehidden = 'true'";

export function createChangesetsService({ cm }: ServiceContext): ChangesetsApi {
  /** One changeset by its number, in `repository` when it isn't the place's: null when there's none by it. */
  async function findById(place: Place, changesetId: number, repository: string | undefined, read: OneObjectRead = {}): Promise<Changeset | null> {
    const at = cmPlace(place);
    const args = findQueryArgs(FOUND_CHANGESETS, `where changesetid = ${changesetId}`, repository ?? at.repository);
    const [changeset] = await readOneObject(cm, args, layoutReader(FOUND_CHANGESETS), at.options, read);
    return changeset ?? null;
  }

  return {
    // Read as they arrive: every changeset of a large repository (280,000) is tens of MB.
    list(place, filter) {
      const at = cmPlace(place);
      const args = findArgs(FOUND_CHANGESETS, filter, 'changesetid desc', filter.branch ? [IGNORE_HIDDEN] : [], at.repository);
      return cm.queryRecords(args, layoutReader(FOUND_CHANGESETS), at.options);
    },

    async get(place, changesetId, repository) {
      const changeset = await findById(place, changesetId, repository);
      if (!changeset) throw new Error(`Changeset ${changesetId} was not found.`);
      return changeset;
    },

    find: (place, changesetId, read = {}) => findById(place, changesetId, undefined, read),

    // The parent of the branch's first changeset, as `cm diff br:<branch>` and `xlinkBeforePoint` take it: one quick
    // `cm find` that reads one record, whatever the branch's size.
    async branchStart(place, branch) {
      const at = cmPlace(place);
      const query = `where ${IGNORE_HIDDEN} and ${equalsCondition('branch', branch)} order by changesetid asc limit 1`;
      const [start] = await cm.queryRecords(findQueryArgs(FOUND_BRANCH_STARTS, query, at.repository), layoutReader(FOUND_BRANCH_STARTS), at.options);
      return start ?? null;
    },

    async editComment(place, changesetId, comment) {
      const at = cmPlace(place);
      await cm.query(['changeset', 'editcomment', at.spec(`cs:${changesetId}`), comment], at.options);
    },

    async moveToBranch(place, changesetId, branch) {
      const at = cmPlace(place);
      await cm.query(['changeset', 'move', at.spec(`cs:${changesetId}`), at.spec(`br:${branch}`)], at.options);
    },

    async remove(place, changesetId) {
      const at = cmPlace(place);
      await cm.query(['changeset', 'delete', at.spec(`cs:${changesetId}`)], at.options);
    },
  };
}
