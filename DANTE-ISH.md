# Dante iSH

This checkout builds a separate iSH installation for full-screen FirstPair
reading in Emacs.

## Identity

- Display name: `1Unix`
- Bundle identifier: `net.hurz.danteish`
- App Group: `group.net.hurz.danteish`
- File Provider: `net.hurz.danteish.FileProvider`
- Development team: `8UJ4WU7CE9` (Alexy KHRABROV Personal Team)

The user-font entitlement is omitted because Apple Personal Teams cannot
provision it. System and bundled terminal fonts remain available.

## Touch Contract

The **Keep Keyboard Hidden** switch in iSH Settings controls terminal taps while
a program has enabled VT mouse reporting. Turn it on once after installing
1Unix. When enabled, a one-finger tap remains an application mouse event and
does not summon a hidden software keyboard. This keeps Emacs Reader controls,
dictionary words, and menu items usable in full-screen iSH.

A two-finger tap in terminal mouse mode explicitly restores keyboard focus.
When terminal mouse reporting is disabled, an ordinary tap continues to focus
the terminal and show the keyboard.

In VT mouse mode, 1Unix converts the active `UITouch` directly into hterm
mouse press, drag, and release reports. Do not rely on WebKit compatibility
mouse events: on iPhone they can lose the finger position and collapse every
tap to the first terminal row. Suppress that compatibility sequence at the
hterm iframe document in capture phase, because hterm listens on the document
as well as its screen and cursor.

Emacs `xterm-mouse-mode` requests DECSET 1003 so a TTY popup menu can update
its active row from pointer movement before accepting the release. The bundled
hterm 1.91 does not implement 1003. On a touchscreen, map it to hterm's drag
tracking and emit one movement report at the touch-down cell before the press.
Without that report, a correctly located press and release still select the
menu's initial item: **File -> Quit** opens **Find File**, and translation
choices collapse to **None**.

DECSET 1003 touch clicks use one stable cell. Emacs does not dispatch a terminal
mode-line click until it receives mouse release, but a finger can drift to
another cell before `touchend`. 1Unix waits for either release or deliberate
vertical movement. A released tap emits movement, press, and release together
at the touch-down cell. A vertical drag emits terminal wheel steps at that same
cell, letting Emacs scroll the window where the gesture began without clicking
its text. Restrict this behavior to 1003: other terminal mouse modes retain
ordinary press, drag, and release semantics.

Build 819 adds a persistent one-line Reader strip below the terminal. Unlike
the ordinary extra-key row, it is part of the terminal layout rather than an
`inputAccessoryView`, so hiding the software keyboard leaves it visible. When
the keyboard opens, the strip moves above it. Its eight buttons send ordinary
keyboard input and therefore bypass terminal mouse decoding: **Tr< Tr> 2nd
Lang << < > >>** send `[`, `]`, `b`, `t`, `K`, `k`, `j`, and `J`. Keep this
contract synchronized with FirstPair Reader; the uppercase word commands skip
common function words, while lowercase commands move one source word.
The keyboard accessory row removes the old gesture arrow pad and retains the
four explicit arrow keys in that space; never ship both representations.
Press-and-hold gives the four translation controls their paired action without
sending the ordinary release action: **Tr<** advances, **Tr>** retreats,
**2nd** keeps only the configured favorite translations, and **Lang** cycles
to the previous language state. Reader binds these actions to `]`, `[`, `B`,
and `T`.

Build 823 restores **2nd** with a precise additive meaning. Translation menus
remain checkboxes: an unchecked edition is added beside the editions already
shown, and a checked edition removes itself. A tap sends `b` to add the
Reader's configured favorite editions without replacing anything. A hold sends
`B` to keep those favorites and remove only the other editions currently shown.

Build 824 adds native vertical finger scrolling in terminal mouse mode. Drag
up or down in the poem to send natural-direction wheel steps to that Emacs
window. Movement shorter than three quarters of a text line remains a tap, so
narrow Reader buttons and TTY-menu rows keep their stable touch-down target.
Run `node tests/terminal-touch-gesture.test.js` before the signed app build.

Build 825 adds a separate **Show Dante Reader Bar** switch in 1Unix Settings.
It defaults on and changes the terminal layout immediately: off hides the
persistent native Reader strip and lets the terminal use its space; on restores
the strip. This preference is independent of **Keep Keyboard Hidden**, does not
alter the ordinary keyboard accessory row, and persists across launches.

Build 826 repairs the hide transition. The storyboard's terminal-bottom outlet
is weak and may disappear after its constraint is deactivated, so never switch
between that old constraint and the terminal-to-Reader-bar constraint. Keep the
latter active permanently and collapse the Reader bar's height to zero when it
is hidden. After the synchronous native layout, explicitly resize, invalidate,
redraw, and reposition hterm's cursor. Run both
`node tests/terminal-touch-gesture.test.js` and
`node tests/terminal-reader-bar.test.js` before signing. The simulator UI test
`UITests/testReaderBarVisibilityKeepsTerminalVisible` repeats two hide/show
cycles, checks the terminal text after each transition, verifies the Reader
controls' visibility, and confirms the terminal frame changes with the bar.

Bundled terminal fonts must finish loading before hterm's cell geometry is
accepted. The terminal remeasures and redraws after the selected face loads,
and disables kerning and ligatures so the visible glyphs, text cursor, and
mouse cells share one fixed grid. Keep the terminal hidden during bootstrap,
then atomically reapply its selected font, full foreground/background colors,
and cursor color before revealing the settled first paint.

## Build

The Xcode build requires Meson, Ninja, LLVM, and LLD from Homebrew. Build a
generic signed iOS app to avoid device-thinning stalls in Xcode's asset
compiler:

```sh
cd ~/src/ish
brew install meson ninja llvm lld
FIRSTPAIR_REQUIRE_PRIVATE_FONTS=1 \
PATH="/opt/homebrew/opt/lld/bin:$PATH" \
  xcodebuild -project iSH.xcodeproj \
  -scheme 1Unix \
  -configuration Debug-ApplePleaseFixFB19282108 \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
```

Install the resulting `1Unix.app` with Xcode or `xcrun devicectl`. A free
Personal Team profile lasts seven days, so repeat the signed build and install
before or after its expiration. The first installation may require trusting
the developer under Settings > General > VPN & Device Management.

Installing a new build over the existing `net.hurz.danteish` app preserves its
container, including installed Alpine packages, books, home-directory files,
and `.zshrc`. Deleting the app, changing its bundle identifier or App Group, or
resetting its filesystem removes or disconnects that state.

Build 827 was the first archive signed under the Apple Developer Program
(team `8UJ4WU7CE9`, the same team the Personal builds used, so the App ID,
App Group, and installed container carry over). PragmataPro is embedded from
`~/Library/Application Support/FirstPair/private-fonts` and the build fails
without it (`FIRSTPAIR_REQUIRE_PRIVATE_FONTS=1`); the family is licensed to
the author and never committed. The App Store Connect record **1Unix**
(bundle `net.hurz.danteish`) must exist before an upload; the website creates
it, Xcode's sheet and `xcodebuild` cannot.

Build 828 renames the product: `PRODUCT_NAME` is `1Unix`, the schemes are
`1Unix` and `1Unix+Linux`, the archive and app are `1Unix.app`, and CI,
`upload-build`, and fastlane use those names, the `net.hurz.danteish`
identifier, and team `8UJ4WU7CE9`. The Xcode target and project file keep
the name `iSH` so upstream merges stay small.

## TestFlight

```sh
cd ~/src/ish
agvtool new-version -all <build>        # then restore app/FileProvider/Info.plist and
                                        # app/UITests/Info.plist: agvtool replaces their
                                        # $(CURRENT_PROJECT_VERSION) placeholders with a literal
FIRSTPAIR_REQUIRE_PRIVATE_FONTS=1 \
PATH="/opt/homebrew/opt/lld/bin:$PATH" \
  xcodebuild -project iSH.xcodeproj -scheme 1Unix -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/1Unix <build>.xcarchive" \
  -allowProvisioningUpdates COMPILER_INDEX_STORE_ENABLE=NO archive
xcodebuild -exportArchive \
  -archivePath "$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/1Unix <build>.xcarchive" \
  -exportOptionsPlist app/ExportOptions.plist -exportPath /tmp/1unix-export \
  -allowProvisioningUpdates
```

`app/ExportOptions.plist` uploads to App Store Connect with automatic
signing and `uploadSymbols` off: with Xcode 26.6 the packaging step fails
with the bare message "Copy failed" whenever it tries to copy this
archive's dSYMs (they are valid and match the binary's UUID; a development
export and a store export without symbols both succeed). Symbolicate crash
logs locally from the archive's `dSYMs/` instead. Archiving into Xcode's
Archives folder also lists the build in Organizer. Xcode must have the
developer Apple Account signed in (Settings > Accounts).

## Phone Check

1. Open Dante in Emacs with terminal mouse mode enabled.
2. Hide the iSH keyboard and tap Next word, Previous word, and translation
   controls. The keyboard must remain hidden.
3. Tap a word in the poem. The dictionary must update without showing the
   keyboard.
4. Open the Emacs File menu and select an item below the first row. The tapped
   item must run, rather than the first item in the menu.
5. Open Tr-Eng or Tr-Rus and select a translation below None. The tapped
   translation must become current.
6. Type across a full line in PragmataPro. The cursor must stay on the next
   cell after the last visible character, without accumulating horizontal
   drift.
7. Force-quit and reopen repeatedly. Every launch must use the same crisp,
   full-contrast font; no launch may expose the fallback or transparent
   bootstrap state.
8. Two-finger tap the terminal. The keyboard must appear.
9. Exit terminal mouse mode and hide the keyboard. An ordinary terminal tap
   must show it again.
10. Drag upward and downward through the poem. The poem window must scroll in
    the natural direction without looking up a word, activating a link, moving
    a pane divider, showing the keyboard, or scrolling the Dictionary pane.
11. In 1Unix Settings, turn **Show Dante Reader Bar** off. The strip must vanish
    and the terminal must fill its space immediately. Turn it on and confirm
    that the same controls return without changing **Keep Keyboard Hidden**.
    Neither transition may blank the terminal or require a force-quit; Emacs
    text and cursor must redraw at the new dimensions each time.

Build 817 passed the physical-device menu check on 2026-09-02: **File ->
Quit** exited Emacs, **Tr-Eng -> Norton** and **Tr-Rus -> Ilyushin** changed
their respective translations, the keyboard stayed hidden, and both launches
kept the bundled PragmataPro rendering crisp.

Build 818 adds one acceptance test: a single touch on Reader **Next** must
advance exactly once before finger drift or a second tap. The same tap must not
resize a pane, open Messages, or leave button help in the echo area. The stock
File menu and both translation menus must continue to select non-first rows.

Build 819 additionally requires the native Reader strip to remain visible after
the keyboard is hidden. Each Reader-strip button must execute once without
restoring the keyboard; `>>` must skip intervening prepositions or forms of
*essere*, and `Tr<`/`Tr>` must change the translation under point.

Build 824 additionally requires a short poem tap to retain all build 818 menu
and button behavior, while a vertical poem drag scrolls only the poem window.

Build 825 additionally requires the native Reader strip setting to survive a
force-quit and relaunch in both its shown and hidden states.

Build 826 additionally requires repeated on/off transitions in one live Emacs
session, with both keyboard-hidden and keyboard-visible layouts.
