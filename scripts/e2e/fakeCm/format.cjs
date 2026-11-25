// Prints records the way `cm` does: `--format` templates filled in.

/**
 * `record` printed through a `--format` template: each `{field}` replaced by its value. A field the record lacks
 * throws, naming it: the fake has to learn it. A .NET format after the field (`{date:o}`) is left to the value, whose
 * dates are ISO 8601 already.
 */
function fillFormat(template, record) {
  return template.replace(/\{(\w+)(?::[^}]*)?\}/g, (_placeholder, field) => {
    if (!(field in record)) throw new Error(`The fake cm has no {${field}} field for this object`);
    return String(record[field]);
  });
}

/** Records printed through a `--format` template, one line each. */
function formatRecords(template, records) {
  return records.map((record) => `${fillFormat(template, record)}\n`).join('');
}

/** The value of `--<name>=<value>` among a command's arguments, or undefined when it isn't there. */
function optionValue(args, name) {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

module.exports = { fillFormat, formatRecords, optionValue };
