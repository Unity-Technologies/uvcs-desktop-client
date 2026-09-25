/** An attribute type, e.g. `status`, that can be given values on branches, changesets and labels. */
export interface AttributeType {
  id: number;
  name: string;
  comment: string;
  owner: string;
  date: string;
  repository: string;
}

/** The value an object has for an attribute. */
export interface AttributeValue {
  name: string;
  value: string;
}
