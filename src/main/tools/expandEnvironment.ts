/**
 * The program with `%VAR%` read from the environment, as the official client's external tools read it on every OS;
 * Windows' names ignore case. A variable not set stays as written, as Windows leaves it.
 */
export function expandEnvironment(program: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  return program.replace(/%([^%\s]+)%/g, (written, name: string) => variable(env, name, platform) ?? written);
}

function variable(env: NodeJS.ProcessEnv, name: string, platform: NodeJS.Platform): string | undefined {
  if (env[name] !== undefined) return env[name];
  if (platform !== 'win32') return undefined;
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : env[key];
}
