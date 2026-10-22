/** client.conf as the official client saves it: XML with a byte order mark, its namespaces, CRLF on Windows. */
export function clientConf(mergeTools: string, newline = '\n'): string {
  return [
    '\uFEFF<?xml version="1.0" encoding="utf-8"?>',
    '<ClientConfigData xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    '  <Language>en</Language>',
    '  <WorkspaceServer>local</WorkspaceServer>',
    mergeTools,
    '  <DiffTools>',
    '    <DiffToolData>',
    '      <FileType>enTextFile</FileType>',
    '      <FileExtensions>*</FileExtensions>',
    '      <Tools>',
    '        <string>plastic xmerge -s="@sourcefile" -sn="@sourcesymbolic" -d="@destinationfile" -dn="@destinationsymbolic"</string>',
    '      </Tools>',
    '    </DiffToolData>',
    '  </DiffTools>',
    '</ClientConfigData>',
  ].join(newline);
}

/** One `<MergeToolData>`; no `<FileType>` for an entry that takes text and binary files alike. */
export function mergeToolData(fileType: 'enTextFile' | 'enBinaryFile' | null, extensions: string, commands: string[]): string {
  return [
    '    <MergeToolData>',
    ...(fileType ? [`      <FileType>${fileType}</FileType>`] : []),
    `      <FileExtensions>${extensions}</FileExtensions>`,
    '      <Tools>',
    ...commands.map((command) => `        <string>${command.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</string>`),
    '      </Tools>',
    '    </MergeToolData>',
  ].join('\n');
}

export const mergeTools = (...entries: string[]): string => ['  <MergeTools>', ...entries, '  </MergeTools>'].join('\n');
