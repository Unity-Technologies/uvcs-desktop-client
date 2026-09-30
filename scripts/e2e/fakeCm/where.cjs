// The part of a `cm find` query the fake honours: comparisons of a field the objects have with a number or a quoted
// value (`changesetid > 5`, `branch = '/main'`, `date >= '2026-07-01'`, `owner = 'me'`), joined by `and`. Any other
// condition (`like`, `or`, a field the objects lack) keeps every object: the smoke test checks that views show, not
// exactly which objects they show.
const { OWNER } = require('./repository.cjs');

const COMPARISON = /^(\w+)\s*(>=|<=|=|>|<)\s*(?:'([^']*)'|(-?\d+))$/i;

const COMPARE = {
  '=': (a, b) => a === b,
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
};

/** `where a = 1 and b > 'x' order by … limit …` → its comparisons. */
function comparisons(query) {
  const where = /\bwhere\s+(.*?)(\s+order\s+by\b.*|\s+limit\b.*)?$/i.exec(query)?.[1] ?? '';
  return where
    .split(/\s+and\s+/i)
    .map((condition) => COMPARISON.exec(condition.trim()))
    .filter(Boolean)
    .map(([, field, operator, text, number]) => ({ field: field.toLowerCase(), operator, value: number === undefined ? valueOf(text) : Number(number) }));
}

/** `'me'` is the signed-in user. */
function valueOf(text) {
  return text === 'me' ? OWNER : text;
}

/** A branch's `name` in a query may be its last segment (`task-001` for `/main/task-001`). */
function fieldValues(record, field) {
  const value = record[field];
  return field === 'name' && typeof value === 'string' ? [value, value.split('/').pop()] : [value];
}

/** The records a `cm find` query finds. */
function matching(records, query) {
  const conditions = comparisons(query).filter(({ field }) => records.some((record) => field in record));
  return records.filter((record) => conditions.every(({ field, operator, value }) => fieldValues(record, field).some((candidate) => COMPARE[operator](candidate, value))));
}

module.exports = { matching };
