// Unity's `.meta` files as data: the YAML subset Unity writes (two-space indented block mappings, block sequences
// whose items are mappings, one-line flow mappings like `{fileID: 0, guid: …}` and `[]`/`{}`), scalars kept as the
// strings they are. Enough for a ModelImporter's settings; a full YAML library would be a dependency for this one
// reader.

export type UnityYaml = string | UnityYaml[] | { [key: string]: UnityYaml };

interface Line {
  indent: number;
  text: string;
}

export function parseUnityYaml(text: string): { [key: string]: UnityYaml } {
  const lines: Line[] = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#') && !line.startsWith('%') && !line.startsWith('---'))
    .map((line) => ({ indent: line.length - line.trimStart().length, text: line.trim() }));
  const at = { index: 0 };
  const root = block(lines, at, 0);
  return isMapping(root) ? root : {};
}

/** The block starting at `at` whose lines are indented `indent` or more: a sequence if it starts with `- `. */
function block(lines: Line[], at: { index: number }, indent: number): UnityYaml {
  const first = lines[at.index];
  if (!first || first.indent < indent) return {};
  return first.text.startsWith('- ') || first.text === '-' ? sequence(lines, at, first.indent) : mapping(lines, at, first.indent);
}

function mapping(lines: Line[], at: { index: number }, indent: number, into: { [key: string]: UnityYaml } = {}): { [key: string]: UnityYaml } {
  while (at.index < lines.length) {
    const line = lines[at.index]!;
    if (line.indent !== indent || line.text.startsWith('- ')) break;
    at.index++;
    const colon = keyEnd(line.text);
    if (colon === -1) continue;
    const key = line.text.slice(0, colon).trim();
    const rest = line.text.slice(colon + 1).trim();
    into[key] = rest === '' ? nested(lines, at, indent) : scalarOrFlow(rest);
  }
  return into;
}

/** A key's value on the lines below it: deeper, or a sequence at the same indent (Unity writes `key:\n- item`). */
function nested(lines: Line[], at: { index: number }, indent: number): UnityYaml {
  const next = lines[at.index];
  if (!next) return '';
  if (next.indent > indent) return block(lines, at, indent + 1);
  if (next.indent === indent && next.text.startsWith('- ')) return sequence(lines, at, indent);
  return '';
}

function sequence(lines: Line[], at: { index: number }, indent: number): UnityYaml[] {
  const items: UnityYaml[] = [];
  while (at.index < lines.length) {
    const line = lines[at.index]!;
    if (line.indent !== indent || !(line.text.startsWith('- ') || line.text === '-')) break;
    const content = line.text === '-' ? '' : line.text.slice(2).trim();
    if (content === '') {
      at.index++;
      items.push(block(lines, at, indent + 1));
    } else if (keyEnd(content) !== -1 && !content.startsWith('{')) {
      // `- key: value` opens a mapping whose other keys line up with `key`.
      lines[at.index] = { indent: indent + 2, text: content };
      items.push(mapping(lines, at, indent + 2));
    } else {
      at.index++;
      items.push(scalarOrFlow(content));
    }
  }
  return items;
}

/** Where a `key:` ends: a colon followed by a space or the line's end, outside a flow mapping. */
function keyEnd(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') return -1;
    if (text[i] === ':' && (i === text.length - 1 || text[i + 1] === ' ')) return i;
  }
  return -1;
}

function scalarOrFlow(text: string): UnityYaml {
  if (text === '[]') return [];
  if (text === '{}') return {};
  if (text.startsWith('{') && text.endsWith('}')) {
    return Object.fromEntries(
      text
        .slice(1, -1)
        .split(',')
        .map((pair) => pair.split(/:\s*/))
        .filter((pair) => pair.length >= 2)
        .map(([key, ...value]) => [key!.trim(), value.join(':').trim()]),
    );
  }
  return text.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
}

export function isMapping(value: UnityYaml | undefined): value is { [key: string]: UnityYaml } {
  return typeof value === 'object' && !Array.isArray(value);
}
