/**
 * The folders of the PATH, in order. Windows may name it `Path` in an environment given as an object, and quotes a
 * folder holding its separator (`"C:\Tools;Old"`).
 */
export function pathFolders(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const value = env.PATH ?? env.Path ?? '';
  if (platform !== 'win32') return value.split(':').filter(Boolean);
  return (value.match(/(?:"[^"]*"|[^;])+/g) ?? []).map((folder) => folder.replaceAll('"', '').trim()).filter(Boolean);
}
