# Rules the tests enforce

Static tests keep the rules every change in the repository must respect: each one reads the sources (or the built
app) and fails on any place that breaks its rule. When one fails, fix the code, or extend the test with the reason a
place is an exception; never work around it. What makes a new one worth adding: CLAUDE.md "Rules the tests enforce".
A new static test joins this list.

| Test                                                      | Rule                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `main/cm/noExternalUi.test.ts`                            | `cm` never opens a tool; processes start only where allowed       |
| `main/cm/noOredIdLookups.test.ts`                         | no `where id = 1 or id = 2 …` queries                             |
| `scripts/e2e/smoke.mjs` (`duplicateReport`)               | no step sends the same command line twice from the same folder (scripts/e2e/README.md, "Duplicate server commands") |
| `app/navigation/smokeOpensEveryPage.test.ts`              | the smoke test opens every kind of page (`Page`): each is in `smoke.mjs`'s `PAGES`, and a run fails when no step shows one |
| `main/cm/noStickyShellOptions.test.ts`                    | no option a `cm shell` keeps for its session (`--username`, `--server`…: `STICKY_SHELL_OPTIONS`) reaches a pooled shell |
| `main/cm/commandOutputs.test.ts`, `testing/fakeCmClient.test.ts` | no list is read as one string; every command says how it's read (`COMMAND_OUTPUTS`) |
| `shared/noRuntimeDependencies.test.ts`                    | `shared/` imports only its own modules                            |
| `renderer/src/rendererTiers.test.ts`                      | `lib/` and `ui/` never import the tiers above them                |
| `lib/shortcutRegistry.test.ts`                            | every shortcut is in the registry; memos re-read changed keys, no module constant keeps one; no Ctrl+Alt off Mac |
| `lib/menuGroups.test.ts`, `components/menuGrammar.test.ts` | every object menu follows one grammar                            |
| `styles/tokens.test.ts`, `focusRings.test.ts`             | text 4.5:1 and focus rings 3:1 in both themes                     |
| `styles/noRawColors.test.ts`                              | colors come from `styles/tokens.css`; the few written out say why |
| `renderer/src/noAiLookalikeIcons.test.ts`                 | no sparkles or wands: "Automatic" never reads as an AI feature    |
| `renderer/src/hoverKeepsLayout.test.ts`                   | no hover rule changes a box's size: a box that grows on hover can wrap away from the pointer and flicker |
| `renderer/src/viewWrappersMakeNoStackingContext.test.ts`  | the boxes the views sit in make no stacking context: a view's overlay lies over the window |
| `renderer/src/viewWrappersFitTheWindow.test.ts`           | no box the views sit in grows past the window, so what holds more than fits scrolls |
| `renderer/src/codeScrollsSideways.test.ts`                | every place showing code with Pierre has `PaneScrollbars`         |
| `renderer/src/effectsReturnCleanUps.test.ts`              | no effect returns what a DOM call gives (`scrollIntoView`'s promise), which React takes for its clean-up |
| `renderer/src/elementsKeptWhileHidden.test.ts`            | an element held in state comes from `useKeptElement`, kept while a view's `Activity` hides it |
| `renderer/src/noDocumentWideIds.test.ts`                  | no component writes out an element id: views kept mounted would share it (`useId`) |
| `renderer/src/chipsAreLinks.test.ts`                      | a comment's chips are links, except where a click belongs to what holds them (`CHIPS_NOT_LINKS` says why for each) |
| `renderer/src/detailsPanelsHide.test.ts`                  | every details panel has the header button that hides it (`DetailsToggleButton`) |
| `renderer/src/detailsPanelsShowAttributesInSection.test.ts` | every details panel shows attributes in its Attributes section (`AttributesDetailsSection`), never as chips in its header |
| `renderer/src/splittersRemembered.test.ts`               | every splitter remembers where it was dragged, under a key of its own (`RememberedSplitPane`) |
| `renderer/src/windowStorageHoldsLayoutOnly.test.ts`      | the window's storage holds only layout (`LAYOUT_STORES`), and only maps keyed by something of the window (`KEYED_MAPS`): places are settings |
| `renderer/src/listViewsRefresh.test.ts`                   | every list view (`ObjectListView`) has the Refresh button in its header (`ViewRefreshButton`) |
| `renderer/src/placesCoveredBySignIn.test.ts`              | every window showing a place's views or pages covers them with the sign-in screen (`SignInCover`) |
| `renderer/src/rowActionsEverywhere.test.ts`               | every list driven from its filter whose results have actions (`isRowMenuKey`) shows the "…" (`RowActionsButton`) and opens it on a right click |
| `renderer/src/newButtonsShowTheirObject.test.ts`          | every "New …" button shows what it creates with a plus (an icon named `…Plus`, like `TagPlus`), never the bare `Plus` |
| `window/workspaceMenuCommands.test.ts`                    | app menu commands match the workspace commands                    |
| `main/cm/noCmInternalFiles.test.ts`                       | nothing reads `cm`'s own files (`.plastic/`, the config folder); only the first-run import reads the config, never writes it |
| `scripts/build/dependencyLicenses.test.ts`                | every package in package-lock.json has a permissive license (`PERMISSIVE_LICENSES`) |
| `scripts/build/thirdPartyNotices.test.ts`, `suppliedLicenses.test.ts` | every `SUPPLIED_LICENSES` text is a full license for the license package-lock.json names; `npm run build` fails on a bundled package without a license text |
| `scripts/build/pinnedActions.test.ts`                     | every GitHub action is pinned to a commit SHA                     |
| `scripts/build/releaseNote.test.ts`, the Release note check | every pull request has a release note for users, or says why not (`readReleaseNote`); no picture or video sits after the closing line or in "Fixed issues", where an unreferenced `--attach` lands, and none shows a file never uploaded; one in backticks or a fence is text (`misplacedPicture`) |
| `scripts/build/noInvisibleCharacters.test.ts`               | no source, script or doc holds an invisible formatting character (bidirectional controls, zero-width joiners): an emoji that needs one writes it as an escape |
| `scripts/build/pierreSkillVersion.test.ts`                | the `pierre-diffs` and `pierre-highlights` skills describe the @pierre/diffs and @pierre/highlights versions installed |
| `scripts/build/linuxDesktopName.test.ts`                  | the Linux `.desktop` file is named as Electron names the app (`desktopName`) |
| `shared/links/parseLink.test.ts`                          | every link shape reads back as written; the official client's links keep opening |
| `app/links/linkNavigation.test.ts`                        | every sidebar view has a link name, and every link name opens a view |
| `components/menuGrammar.test.ts` (Copy)                   | every object's Copy menu offers its link                          |
| `main/links/schemeRegistration.test.ts`                   | the installers register `uvcs://` with the command the app registers |

Not enforced yet: no `any` (there are none today). A static test for it is welcome.
