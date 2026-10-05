import type { AppIdentity } from './appIdentity';

/** JetBrains IDEs: one bundle per edition on macOS; on Windows, its installer's name or the Toolbox's (`Rider 2025.2`). */
function jetbrains(bundleIds: string[], bundles: string[], windowsName: string, desktopIds: string[]): AppIdentity {
  return {
    mac: { bundleIds, bundles: bundles.map((bundle) => `${bundle}.app`) },
    windows: { displayNames: [`JetBrains ${windowsName}`, windowsName], publishers: ['JetBrains s.r.o.'] },
    linux: { desktopIds },
  };
}

/**
 * How the OS knows each app the catalogs name (`KNOWN_EDITORS`, `KNOWN_TERMINALS`, `KNOWN_TOOLS`), from GitHub
 * Desktop's `editors/*` and `shells/*` and each app's installers. An app that is both an editor and a merge tool is
 * described here once.
 */
export const APP_IDENTITIES = {
  vscode: {
    mac: { bundleIds: ['com.microsoft.VSCode'], bundles: ['Visual Studio Code.app'] },
    windows: { displayNames: ['Microsoft Visual Studio Code'], publishers: ['Microsoft Corporation'] },
    linux: { desktopIds: ['code.desktop', 'com.visualstudio.code.desktop', 'code_code.desktop'] },
  },
  vscodeInsiders: {
    mac: { bundleIds: ['com.microsoft.VSCodeInsiders'], bundles: ['Visual Studio Code - Insiders.app'] },
    windows: { displayNames: ['Microsoft Visual Studio Code Insiders'], publishers: ['Microsoft Corporation'] },
    linux: { desktopIds: ['code-insiders.desktop', 'code-insiders_code-insiders.desktop'] },
  },
  vscodium: {
    mac: { bundleIds: ['com.vscodium'], bundles: ['VSCodium.app'] },
    windows: { displayNames: ['VSCodium'], publishers: ['VSCodium', 'Microsoft Corporation'] },
    linux: { desktopIds: ['codium.desktop', 'com.vscodium.codium.desktop', 'codium_codium.desktop'] },
  },
  cursor: {
    mac: { bundleIds: ['com.todesktop.230313mzl4w4u92'], bundles: ['Cursor.app'] },
    windows: { displayNames: ['Cursor'], publishers: ['Anysphere'] },
    linux: { desktopIds: ['cursor.desktop'] },
  },
  windsurf: {
    mac: { bundleIds: ['com.exafunction.windsurf'], bundles: ['Windsurf.app'] },
    windows: { displayNames: ['Windsurf'], publishers: ['Codeium'] },
    linux: { desktopIds: ['windsurf.desktop'] },
  },
  zed: {
    mac: { bundleIds: ['dev.zed.Zed', 'dev.zed.Zed-Preview'], bundles: ['Zed.app', 'Zed Preview.app'] },
    windows: { displayNames: ['Zed'], publishers: ['Zed Industries'] },
    linux: { desktopIds: ['dev.zed.Zed.desktop', 'zed.desktop'] },
  },
  sublimeText: {
    mac: { bundleIds: ['com.sublimetext.4', 'com.sublimetext.3'], bundles: ['Sublime Text.app'] },
    windows: { displayNames: ['Sublime Text'], publishers: ['Sublime HQ Pty Ltd'] },
    linux: { desktopIds: ['sublime_text.desktop', 'com.sublimetext.three.desktop'] },
  },
  visualStudio: {
    // Every edition and year ("Visual Studio Community 2022"); Build Tools have no IDE and are left out by its program.
    windows: { displayNames: ['Visual Studio '], publishers: ['Microsoft Corporation'] },
  },
  rider: jetbrains(['com.jetbrains.rider'], ['Rider'], 'Rider', ['jetbrains-rider.desktop', 'rider_rider.desktop']),
  intellij: jetbrains(['com.jetbrains.intellij', 'com.jetbrains.intellij.ce'], ['IntelliJ IDEA', 'IntelliJ IDEA Ultimate', 'IntelliJ IDEA CE'], 'IntelliJ IDEA', [
    'jetbrains-idea.desktop',
    'jetbrains-idea-ce.desktop',
    'intellij-idea-ultimate_intellij-idea-ultimate.desktop',
    'intellij-idea-community_intellij-idea-community.desktop',
  ]),
  webstorm: jetbrains(['com.jetbrains.WebStorm'], ['WebStorm'], 'WebStorm', ['jetbrains-webstorm.desktop', 'webstorm_webstorm.desktop']),
  pycharm: jetbrains(['com.jetbrains.pycharm', 'com.jetbrains.pycharm.ce'], ['PyCharm', 'PyCharm Professional Edition', 'PyCharm CE'], 'PyCharm', [
    'jetbrains-pycharm.desktop',
    'jetbrains-pycharm-ce.desktop',
    'pycharm-professional_pycharm-professional.desktop',
    'pycharm-community_pycharm-community.desktop',
  ]),
  clion: jetbrains(['com.jetbrains.CLion'], ['CLion'], 'CLion', ['jetbrains-clion.desktop', 'clion_clion.desktop']),
  goland: jetbrains(['com.jetbrains.goland'], ['GoLand'], 'GoLand', ['jetbrains-goland.desktop', 'goland_goland.desktop']),
  phpstorm: jetbrains(['com.jetbrains.PhpStorm'], ['PhpStorm'], 'PhpStorm', ['jetbrains-phpstorm.desktop', 'phpstorm_phpstorm.desktop']),
  rustrover: jetbrains(['com.jetbrains.rustrover'], ['RustRover'], 'RustRover', ['jetbrains-rustrover.desktop', 'rustrover_rustrover.desktop']),
  androidStudio: {
    mac: { bundleIds: ['com.google.android.studio'], bundles: ['Android Studio.app'] },
    windows: { displayNames: ['Android Studio'], publishers: ['Google LLC'] },
    linux: { desktopIds: ['jetbrains-studio.desktop', 'android-studio.desktop', 'android-studio_android-studio.desktop'] },
  },
  xcode: { mac: { bundleIds: ['com.apple.dt.Xcode'], bundles: ['Xcode.app'] } },
  bbedit: { mac: { bundleIds: ['com.barebones.bbedit'], bundles: ['BBEdit.app'] } },
  nova: { mac: { bundleIds: ['com.panic.Nova'], bundles: ['Nova.app'] } },
  notepadPlusPlus: { windows: { displayNames: ['Notepad++'], publishers: ['Notepad++ Team'] } },
  kate: { linux: { desktopIds: ['org.kde.kate.desktop'] } },
  gnomeTextEditor: { linux: { desktopIds: ['org.gnome.TextEditor.desktop'] } },
  gedit: { linux: { desktopIds: ['org.gnome.gedit.desktop'] } },
  sublimeMerge: {
    mac: { bundleIds: ['com.sublimemerge'], bundles: ['Sublime Merge.app'] },
    windows: { displayNames: ['Sublime Merge'], publishers: ['Sublime HQ Pty Ltd'] },
  },
  beyondCompare: {
    mac: { bundleIds: ['com.ScooterSoftware.BeyondCompare'], bundles: ['Beyond Compare.app'] },
    windows: { displayNames: ['Beyond Compare'], publishers: ['Scooter Software'] },
  },
  terminal: { mac: { bundleIds: ['com.apple.Terminal'], bundles: ['Terminal.app'] } },
  iterm: { mac: { bundleIds: ['com.googlecode.iterm2'], bundles: ['iTerm.app'] } },
  ghostty: { mac: { bundleIds: ['com.mitchellh.ghostty'], bundles: ['Ghostty.app'] } },
  warp: { mac: { bundleIds: ['dev.warp.Warp-Stable'], bundles: ['Warp.app'] } },
  wezterm: { mac: { bundleIds: ['com.github.wez.wezterm'], bundles: ['WezTerm.app'] } },
  kitty: { mac: { bundleIds: ['net.kovidgoyal.kitty'], bundles: ['kitty.app'] } },
  alacritty: { mac: { bundleIds: ['org.alacritty', 'io.alacritty'], bundles: ['Alacritty.app'] } },
  hyper: { mac: { bundleIds: ['co.zeit.hyper'], bundles: ['Hyper.app'] } },
  powershellMac: { mac: { bundleIds: ['com.microsoft.powershell'], bundles: ['PowerShell.app'] } },
  gitBash: { windows: { displayNames: ['Git'], publishers: ['The Git Development Community'] } },
} satisfies Record<string, AppIdentity>;

/** Every bundle identifier named, for the one Spotlight query (`readInstalledApps`). */
export function allBundleIds(): string[] {
  return Object.values(APP_IDENTITIES as Record<string, AppIdentity>).flatMap((identity) => identity.mac?.bundleIds ?? []);
}
