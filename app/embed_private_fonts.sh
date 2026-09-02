#!/bin/sh

set -eu

font_dir="${FIRSTPAIR_PRIVATE_FONT_DIR:-$HOME/Library/Application Support/FirstPair/private-fonts}"
font_names="PragmataPro.ttf PragmataPro-I.ttf PragmataPro-B.ttf PragmataPro-Z.ttf"
app_dir="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
info_plist="$TARGET_BUILD_DIR/$INFOPLIST_PATH"

missing=""
for font_name in $font_names; do
    if [ ! -s "$font_dir/$font_name" ]; then
        missing="$missing $font_name"
    fi
done

if [ -n "$missing" ]; then
    if [ "${FIRSTPAIR_REQUIRE_PRIVATE_FONTS:-0}" = "1" ]; then
        echo "error: required private fonts are missing from $font_dir:$missing" >&2
        exit 1
    fi

    for font_name in $font_names; do
        if [ -e "$app_dir/$font_name" ]; then
            /bin/unlink "$app_dir/$font_name"
        fi
    done
    if [ -f "$info_plist" ]; then
        /usr/bin/python3 - "$info_plist" $font_names <<'PY'
import plistlib
import sys

path, *font_names = sys.argv[1:]
with open(path, "rb") as source:
    info = plistlib.load(source)

if "UIAppFonts" in info:
    info["UIAppFonts"] = [name for name in info["UIAppFonts"] if name not in font_names]

with open(path, "wb") as destination:
    plistlib.dump(info, destination, fmt=plistlib.FMT_BINARY, sort_keys=False)
PY
    fi
    echo "Private PragmataPro fonts not found; building with public fonts only."
    exit 0
fi

for font_name in $font_names; do
    install -m 0644 "$font_dir/$font_name" "$app_dir/$font_name"
done

/usr/bin/python3 - "$info_plist" $font_names <<'PY'
import plistlib
import sys

path, *font_names = sys.argv[1:]
with open(path, "rb") as source:
    info = plistlib.load(source)

declared = info.setdefault("UIAppFonts", [])
for font_name in font_names:
    if font_name not in declared:
        declared.append(font_name)

with open(path, "wb") as destination:
    plistlib.dump(info, destination, fmt=plistlib.FMT_BINARY, sort_keys=False)
PY

echo "Embedded private PragmataPro family from $font_dir"
