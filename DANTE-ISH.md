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

DECSET 1003 touch clicks are atomic in build 818. Emacs does not dispatch a
terminal mode-line click until it receives mouse release, but a finger can
drift to another cell before `touchend`. After reporting movement, 1Unix emits
press and release together at the touch-down cell and consumes the later
physical move/end events. Restrict this behavior to 1003: other terminal mouse
modes retain ordinary press, drag, and release semantics.

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
  -scheme iSH \
  -configuration Debug-ApplePleaseFixFB19282108 \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates \
  COMPILER_INDEX_STORE_ENABLE=NO \
  build
```

Install the resulting `iSH.app` with Xcode or `xcrun devicectl`. A free
Personal Team profile lasts seven days, so repeat the signed build and install
before or after its expiration. The first installation may require trusting
the developer under Settings > General > VPN & Device Management.

Installing a new build over the existing `net.hurz.danteish` app preserves its
container, including installed Alpine packages, books, home-directory files,
and `.zshrc`. Deleting the app, changing its bundle identifier or App Group, or
resetting its filesystem removes or disconnects that state.

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

Build 817 passed the physical-device menu check on 2026-09-02: **File ->
Quit** exited Emacs, **Tr-Eng -> Norton** and **Tr-Rus -> Ilyushin** changed
their respective translations, the keyboard stayed hidden, and both launches
kept the bundled PragmataPro rendering crisp.

Build 818 adds one acceptance test: a single touch on Reader **Next** must
advance exactly once before finger drift or a second tap. The same tap must not
resize a pane, open Messages, or leave button help in the echo area. The stock
File menu and both translation menus must continue to select non-first rows.
