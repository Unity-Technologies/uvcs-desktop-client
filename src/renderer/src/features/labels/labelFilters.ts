import type { Label } from '@shared/domain/label';
import type { QueryFilter } from '@shared/domain/query';
import { pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { userFilterTexts } from '../../lib/userName';

/** What Labels asks `cm find label` for: the time range and the people picked (once picking paused); the text is matched locally. */
export function labelsQuery({ since, people }: { since: SincePreset; people: PeoplePick }, today = new Date()): QueryFilter {
  return { sinceDate: sinceDateFor(since, today), owners: pickedOwners(people) };
}

/** What a label's row shows, which its filter looks through: the name, comment, branch and creator. */
export function labelFilterTexts(label: Pick<Label, 'name' | 'comment' | 'branch' | 'owner'>): string[] {
  return [label.name, label.comment, label.branch, ...userFilterTexts(label.owner)];
}
