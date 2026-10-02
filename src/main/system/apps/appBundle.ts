/**
 * The macOS app bundle a program is inside, if any, which is what opens, comes to the front and shows the app's icon:
 * `/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code` → `/Applications/Visual Studio Code.app`.
 */
export function appBundleOf(executable: string): string | null {
  const match = /^(.*?\.app)\//.exec(executable);
  return match ? match[1]! : null;
}
