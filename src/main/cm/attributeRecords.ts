import type { AttributeType, AttributeValue } from '@shared/domain/attribute';
import { integer, text } from './parseXml';

type XmlRecord = Record<string, unknown>;

/** A record of `cm find attributetype --xml`. */
export function toAttributeType(record: XmlRecord): AttributeType {
  return {
    id: integer(record.ID),
    name: text(record.NAME),
    comment: text(record.COMMENT),
    owner: text(record.OWNER),
    date: text(record.DATE),
    repository: `${text(record.REPNAME)}@${text(record.REPSERVER)}`,
  };
}

/** A record of `cm find attribute --xml`: an object's value of one attribute. */
export function toAttributeValue(record: XmlRecord): AttributeValue {
  return { name: text(record.NAME), value: text(record.VALUE) };
}
