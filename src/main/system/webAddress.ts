/**
 * Whether `url` is a web page, the only thing `shell.openExternal` may open. The OS hands any other scheme to whatever
 * claims it (`file:` runs a program, `smb:` fetches one, `ms-msdt:` starts a Windows tool), so a link from the renderer,
 * a release note or a branch attribute could otherwise start a program instead of a browser.
 */
export function isWebAddress(url: string): boolean {
  return /^https?:\/\/\S/i.test(url);
}
