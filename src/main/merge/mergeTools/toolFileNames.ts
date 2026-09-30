/** The temp files a tool gets for one file: each version named after it, so the tool shows the name and syntax. */
export function toolFileNames(path: string): { base: string; yours: string; incoming: string; result: string } {
  const name = path.split(/[\\/]/).pop()!.replace(/[^\w .-]/g, '_') || 'file';
  const dot = name.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  return { base: `${stem}.BASE${extension}`, yours: `${stem}.YOURS${extension}`, incoming: `${stem}.INCOMING${extension}`, result: name };
}
