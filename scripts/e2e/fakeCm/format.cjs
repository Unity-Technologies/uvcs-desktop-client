// Prints records the way `cm` does: `--format` templates filled in, `find --xml` elements.

/**
 * `record` printed through a `--format` template: each `{field}` replaced by its value. A field the record lacks
 * throws, naming it: the fake has to learn it.
 */
function fillFormat(template, record) {
  return template.replace(/\{(\w+)\}/g, (_placeholder, field) => {
    if (!(field in record)) throw new Error(`The fake cm has no {${field}} field for this object`);
    return String(record[field]);
  });
}

/** Records printed through a `--format` template, one line each. */
function formatRecords(template, records) {
  return records.map((record) => `${fillFormat(template, record)}\n`).join('');
}

/** `cm find <object> --xml`: one `<ELEMENT>` per record, each field an uppercase element of its own. */
function findXml(element, records) {
  const fields = (record) =>
    Object.entries(record)
      .map(([name, value]) => `    <${name.toUpperCase()}>${escapeXml(String(value))}</${name.toUpperCase()}>`)
      .join('\n');
  const body = records.map((record) => `  <${element}>\n${fields(record)}\n  </${element}>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8" ?>\n<PLASTICQUERY>\n${body}\n</PLASTICQUERY>\n`;
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

module.exports = { escapeXml, fillFormat, findXml, formatRecords };
