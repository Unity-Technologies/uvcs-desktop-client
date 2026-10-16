import type { AttributeType, AttributeValue } from '@shared/domain/attribute';
import { repositorySpec } from '@shared/domain/specs';
import { foundObjects } from './foundObjects';
import { integerValue } from './formatRecords';

/** `cm find attributetype`: the attribute types of the repository. */
export const FOUND_ATTRIBUTE_TYPES = foundObjects(
  'attributetype',
  ['id', 'name', 'comment', 'owner', 'date', 'repname', 'repserver'],
  (value): AttributeType => ({
    id: integerValue(value('id')),
    name: value('name'),
    comment: value('comment'),
    owner: value('owner'),
    date: value('date'),
    repository: repositorySpec(value('repname'), value('repserver')),
  }),
);

/** `cm find attribute`: an object's value of one attribute, `name` the attribute type's. */
export const FOUND_ATTRIBUTE_VALUES = foundObjects('attribute', ['name', 'value'], (value): AttributeValue => ({ name: value('name'), value: value('value') }));
