import { parseArgs } from '@shared/domain/mergeTools';
import { children, child, parseXml, text } from '../cm/parseXml';

/**
 * A merge tool the user set up for the official clients in `client.conf` (`<MergeTools>`), for text files. cm picks
 * the first entry whose type and extensions match a file and runs its chain of tools; the last one is the interactive
 * one. The UVCS merge tool's own entries (`mergetool`, `macmergetool`, `plasticgui xmerge`...) are left out: the app
 * offers that tool already.
 */
export interface ClientConfMergeTool {
  executable: string;
  /** In the app's placeholders (`{base}`...), converted from cm's (`@basefile`...). */
  args: string[];
  /** Lowercase, with their dot; null for every file (`*`). */
  extensions: string[] | null;
}

const PLASTIC_TOOLS = new Set(['mergetool', 'macmergetool', 'gtkmergetool', 'binmergetool', 'semanticmergetool', 'semanticmerge', 'plasticgui', 'plastic', 'macplastic', 'macplasticx']);

/** cm's merge variables (`ExternalToolExec.MergeVariables`), as the app fills them. */
const CM_VARIABLES: Record<string, string> = {
  basefile: '{base}',
  sourcefile: '{incoming}',
  destinationfile: '{yours}',
  output: '{result}',
  basesymbolic: '{baseName}',
  sourcesymbolic: '{incomingName}',
  destinationsymbolic: '{yoursName}',
  basehash: '',
  sourcehash: '',
  destinationhash: '',
  filetype: 'text',
  comparationmethod: '',
  fileencoding: 'NONE',
  resultencoding: 'NONE',
  mergetype: 'forced',
  progress: '',
  extrainfofile: '',
};
const CM_VARIABLE = new RegExp(`@(${Object.keys(CM_VARIABLES).sort((a, b) => b.length - a.length).join('|')})`, 'g');

export function readClientConfMergeTools(xml: string): ClientConfMergeTool[] {
  if (!xml.includes('<MergeTools>')) return [];
  const root = child(parseXml(xml, ['MergeToolData', 'string']), 'ClientConfigData');
  return children(child(root, 'MergeTools'), 'MergeToolData').flatMap((entry) => {
    const fileType = text(entry.FileType);
    if (fileType === 'enBinaryFile') return [];
    const command = children(child(entry, 'Tools'), 'string').map(text).filter(Boolean).at(-1);
    const [executable, ...args] = parseArgs(command ?? '');
    if (!executable || isPlasticTool(executable)) return [];
    return [{ executable, args: args.map(toAppPlaceholders), extensions: parseExtensions(text(entry.FileExtensions)) }];
  });
}

function isPlasticTool(executable: string): boolean {
  const name = executable.split(/[\\/]/).pop()!.toLowerCase().replace(/\.exe$/, '');
  return PLASTIC_TOOLS.has(name);
}

function toAppPlaceholders(arg: string): string {
  return arg.replace(CM_VARIABLE, (_match, name: string) => CM_VARIABLES[name]!);
}

function parseExtensions(value: string): string[] | null {
  const extensions = value.split(/[;,]/).map((extension) => extension.trim().toLowerCase()).filter(Boolean);
  return extensions.length === 0 || extensions.includes('*') ? null : extensions;
}
