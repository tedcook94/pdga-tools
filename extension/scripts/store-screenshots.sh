#!/usr/bin/env bash
# Builds the store screenshots and the /rating page image from raw browser
# captures. Needs ImageMagick 7 (`magick`) and the Noto Sans font.
#
#   scripts/store-screenshots.sh <dir with 1.png … 5.png>
#
# 1.png  ratings page, panel expanded
# 2.png  ratings page, panel collapsed
# 3-5.png  the same event results strip: import, imported, update
set -euo pipefail

raw=${1:?usage: store-screenshots.sh <dir with 1.png … 5.png>}
here=$(cd "$(dirname "$0")/.." && pwd)
store=$here/store
web=$here/../web/static/rating

# The gray behind pdga.com's page, so the padding blends in.
bg='rgb(222,223,227)'
navy='#13395b'

# Scales a capture to the stores' 1280 width, centers it on 1280×800 and puts
# the caption in the gray band above it, since Chrome's listing has no captions.
store_shot() {
	local caption=$1 out=$2
	shift 2
	magick "$@" -resize 1280x -background "$bg" -gravity center -extent 1280x800 \
		-gravity north -font Noto-Sans-SemiBold -pointsize 34 -fill "$navy" \
		-annotate +0+18 "$caption" -strip "$out"
}

store_shot "Calculate future ratings before they're published" \
	"$store/screenshot-1-expanded.png" "$raw/1.png"
store_shot "Integrated into your Ratings Detail page" \
	"$store/screenshot-2-collapsed.png" "$raw/2.png"
store_shot "Import or refresh rounds from any event page in one click" \
	"$store/screenshot-3-event-page.png" \
	\( "$raw/3.png" "$raw/4.png" "$raw/5.png" -background "$bg" -splice 0x12 -append -chop 0x12 \)

# The /rating page explains its image in the text around it, so no caption.
magick "$raw/1.png" -resize 1280x -strip "$web/expanded.png"

magick identify -format '%f %wx%h\n' "$store"/screenshot-*.png "$web/expanded.png"
