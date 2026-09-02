# JetBrains Mono

The four unmodified font binaries in this directory were copied from Blink
Shell at commit `a90b4423c8b7a86770c24a7eaa6c13b0a5904b18`:

https://github.com/blinksh/blink/tree/a90b4423c8b7a86770c24a7eaa6c13b0a5904b18/Resources/Fonts

Blink's public source build declares JetBrains Mono as its app font. The
typeface is copyright JetBrains s.r.o. and distributed under the SIL Open
Font License 1.1. `OFL.txt` is an unmodified copy of the license from the
official JetBrains Mono repository:

https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt

The public 1Unix build selects this family at 10 points. hterm uses a private
CSS family alias resolved from the fonts' exact PostScript names so WebKit
cannot silently substitute a different monospace face.

1Unix also recognizes PragmataPro when a licensed copy is present in a private
build. PragmataPro is not distributed in this public repository; builds
without it continue to use JetBrains Mono. Private builds load all four faces
from `$FIRSTPAIR_PRIVATE_FONT_DIR`, or by default from
`~/Library/Application Support/FirstPair/private-fonts/`, through
`app/embed_private_fonts.sh`. Set `FIRSTPAIR_REQUIRE_PRIVATE_FONTS=1` when
building a private device release so a missing face stops the build instead of
silently producing a fallback-only app.

SHA-256:

- `JetBrainsMono-Regular.ttf`: `50e1dcb40298fcfcc21a1ef3cbee9fe9e82709c48ad30ce617472c06a3bd9436`
- `JetBrainsMono-Italic.ttf`: `b74c5f0bed1cf1ffed1da3b01f4a0461b2004f0d316d6aba806c859cbaf14a42`
- `JetBrainsMono-Bold.ttf`: `3cc3cc375448f2570930c5adb6d07f9defa9ceb7d47cb710b859d06a22d4eee6`
- `JetBrainsMono-Bold-Italic.ttf`: `cc087239287bcec2ad72b9845c7e20e36a1b7ac4716e24a97b5a4c2309d3bc73`
- `OFL.txt`: `a76abf002c49097d146e86740a3105a5d00450b1592e820a1109a8c5680cd697`
