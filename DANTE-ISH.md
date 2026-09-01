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

## Build

The Xcode build requires Meson, Ninja, LLVM, and LLD from Homebrew. Build a
generic signed iOS app to avoid device-thinning stalls in Xcode's asset
compiler:

```sh
cd ~/src/ish
brew install meson ninja llvm lld
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
4. Two-finger tap the terminal. The keyboard must appear.
5. Exit terminal mouse mode and hide the keyboard. An ordinary terminal tap
   must show it again.
