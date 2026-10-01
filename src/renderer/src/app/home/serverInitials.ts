/**
 * Two letters telling servers apart where only an icon fits (the folded sidebar): the first letters of the first two
 * words of its name (`snakes-org` → `SO`, `UC_Global_Hack` → `UG`), else its first two letters (`acme` → `AC`). A
 * server address goes by its host (`ssl://plasticscm.acme.fi:8088` → `PL`).
 */
export function serverInitials(label: string): string {
  const host = label.replace(/^[a-z]+:\/\//i, '').split(/[.:/]/)[0] ?? '';
  const words = host.split(/[\s_-]+/).filter((word) => /[a-z0-9]/i.test(word));
  const letters = words.length > 1 ? `${words[0]!.charAt(0)}${words[1]!.charAt(0)}` : (words[0] ?? label).slice(0, 2);
  return letters.toUpperCase();
}
