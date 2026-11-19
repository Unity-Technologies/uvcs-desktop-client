; The Windows installer's own steps (electron-builder.yml, nsis.include), around electron-builder's.
;
; uvcs:// links open in the app (docs/features/deep-links.md, "Registering the scheme"). electron-builder's NSIS writes
; no URL scheme itself, so the installer registers it for the user who installs, with no administrator, running the
; same command the app registers again at each launch (main/links/registerLinkScheme.ts): after `--`, Chromium reads no
; switch, so a link can't slip one in. An update runs the old version's uninstaller first, then writes it again.

!macro customInstall
  WriteRegStr HKCU "Software\Classes\uvcs" "" "URL:Unity Version Control link"
  WriteRegStr HKCU "Software\Classes\uvcs" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\uvcs\DefaultIcon" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\",0"
  WriteRegStr HKCU "Software\Classes\uvcs\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --uvcs-link -- $\"%1$\""
!macroend

; The app's own Unity Version Control (docs/features/cm-runtime.md "The store", `cmStoreFolder`) goes with the app,
; but not on an update, which runs this uninstaller too: the new version keeps what the old one downloaded for it.
; $LOCALAPPDATA is the user's own as long as the installer installs per user (electron-builder.yml's nsis); a per-machine
; one would point it at ProgramData.
!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\uvcs"
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\Unity Version Control\cm"
    RMDir "$LOCALAPPDATA\Unity Version Control"
  ${endIf}
!macroend
